import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { storage } from "./storage";
import { insertUserSchema, insertLeaveRequestSchema, loginSchema } from "@shared/schema";
import bcrypt from "bcrypt";
import { z } from "zod";
import { Storage } from "@google-cloud/storage";

declare module "express-session" {
  interface SessionData {
    passport: { user: string };
  }
}

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      fullName: string;
      role: string;
      department: string;
    }
  }
}

const SALT_ROUNDS = 10;

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: "Unauthorized" });
}

function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!roles.includes(req.user!.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    throw new Error("SESSION_SECRET environment variable is required");
  }
  
  const isProduction = process.env.NODE_ENV === "production";
  
  app.use(
    session({
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: isProduction,
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: isProduction ? "strict" : "lax",
      },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      { usernameField: "email" },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          if (!user) {
            return done(null, false, { message: "Invalid email or password" });
          }
          
          const isValid = await bcrypt.compare(password, user.password);
          if (!isValid) {
            return done(null, false, { message: "Invalid email or password" });
          }
          
          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // Auth routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const data = insertUserSchema.parse(req.body);
      
      const existingEmail = await storage.getUserByEmail(data.email);
      if (existingEmail) {
        return res.status(400).json({ error: "Email already registered" });
      }
      
      const existingEmployeeId = await storage.getUserByEmployeeId(data.employeeId);
      if (existingEmployeeId) {
        return res.status(400).json({ error: "Employee ID already registered" });
      }
      
      const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);
      const user = await storage.createUser({
        ...data,
        password: hashedPassword,
      });
      
      await storage.createPtoCredits({
        userId: user.id,
        totalCredits: 5,
        usedCredits: 0,
        lwopDays: 0,
        year: new Date().getFullYear(),
      });
      
      const userWithCredits = await storage.getUserWithPtoCredits(user.id);
      
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ error: "Login failed after registration" });
        }
        const { password: _, ...safeUser } = userWithCredits!;
        res.status(201).json(safeUser);
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Registration error:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    try {
      loginSchema.parse(req.body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
    }
    
    passport.authenticate("local", async (err: any, user: any, info: any) => {
      if (err) {
        return res.status(500).json({ error: "Authentication error" });
      }
      if (!user) {
        return res.status(401).json({ error: info?.message || "Invalid credentials" });
      }
      
      req.login(user, async (loginErr) => {
        if (loginErr) {
          return res.status(500).json({ error: "Login failed" });
        }
        
        const userWithCredits = await storage.getUserWithPtoCredits(user.id);
        const { password: _, ...safeUser } = userWithCredits!;
        res.json(safeUser);
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", requireAuth, (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    const userWithCredits = await storage.getUserWithPtoCredits(req.user!.id);
    if (!userWithCredits) {
      return res.status(404).json({ error: "User not found" });
    }
    const { password: _, ...safeUser } = userWithCredits;
    res.json(safeUser);
  });

  // Leave request routes
  app.post("/api/leave-requests", requireAuth, async (req, res) => {
    try {
      const data = insertLeaveRequestSchema.parse(req.body);
      const userId = req.user!.id;
      const userWithCredits = await storage.getUserWithPtoCredits(userId);
      
      if (!userWithCredits) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const startDate = new Date(data.startDate);
      const endDate = new Date(data.endDate);
      const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      const remaining = (userWithCredits.ptoCredits?.totalCredits ?? 5) - (userWithCredits.ptoCredits?.usedCredits ?? 0);
      const isLwop = totalDays > remaining;
      
      const leaveRequest = await storage.createLeaveRequest({
        ...data,
        userId,
        totalDays,
        isLwop,
      });
      
      await storage.createApprovalLog({
        leaveRequestId: leaveRequest.id,
        actionBy: userId,
        action: "Filed leave request",
        newStatus: "pending",
        isLwop,
      });
      
      res.status(201).json(leaveRequest);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Create leave request error:", error);
      res.status(500).json({ error: "Failed to create leave request" });
    }
  });

  app.get("/api/leave-requests", requireAuth, async (req, res) => {
    try {
      const requests = await storage.getLeaveRequestsByUser(req.user!.id);
      res.json(requests);
    } catch (error) {
      console.error("Get leave requests error:", error);
      res.status(500).json({ error: "Failed to get leave requests" });
    }
  });

  app.get("/api/leave-requests/pending", requireRole("manager", "hr", "admin"), async (req, res) => {
    try {
      const department = req.user!.role === "manager" ? req.user!.department : undefined;
      const requests = await storage.getPendingLeaveRequests(department);
      res.json(requests);
    } catch (error) {
      console.error("Get pending requests error:", error);
      res.status(500).json({ error: "Failed to get pending requests" });
    }
  });

  app.get("/api/leave-requests/:id", requireAuth, async (req, res) => {
    try {
      const request = await storage.getLeaveRequestWithUser(req.params.id);
      if (!request) {
        return res.status(404).json({ error: "Leave request not found" });
      }
      
      if (request.userId !== req.user!.id && !["manager", "hr", "admin"].includes(req.user!.role)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      
      res.json(request);
    } catch (error) {
      console.error("Get leave request error:", error);
      res.status(500).json({ error: "Failed to get leave request" });
    }
  });

  app.patch("/api/leave-requests/:id/approve", requireRole("manager", "hr", "admin"), async (req, res) => {
    try {
      const { remarks } = req.body;
      const requestId = req.params.id;
      
      const leaveRequest = await storage.getLeaveRequestWithUser(requestId);
      if (!leaveRequest) {
        return res.status(404).json({ error: "Leave request not found" });
      }
      
      if (req.user!.role === "manager" && leaveRequest.department !== req.user!.department) {
        return res.status(403).json({ error: "You can only approve requests from your department" });
      }
      
      if (leaveRequest.status !== "pending") {
        return res.status(400).json({ error: "Leave request is not pending" });
      }
      
      if (leaveRequest.isLwop && !remarks) {
        return res.status(400).json({ error: "Remarks are required for LWOP approval" });
      }
      
      const userCredits = await storage.getPtoCredits(leaveRequest.userId);
      let ptoUsed = 0;
      let lwopUsed = 0;
      
      if (userCredits) {
        if (leaveRequest.isLwop) {
          const remaining = userCredits.totalCredits - userCredits.usedCredits;
          ptoUsed = Math.min(remaining, leaveRequest.totalDays);
          lwopUsed = leaveRequest.totalDays - ptoUsed;
          
          await storage.updatePtoCredits(
            leaveRequest.userId,
            userCredits.usedCredits + ptoUsed,
            userCredits.lwopDays + lwopUsed
          );
        } else {
          ptoUsed = leaveRequest.totalDays;
          await storage.updatePtoCredits(
            leaveRequest.userId,
            userCredits.usedCredits + ptoUsed,
            userCredits.lwopDays
          );
        }
      }
      
      const updatedRequest = await storage.updateLeaveRequestStatus(
        requestId,
        "approved",
        req.user!.id,
        remarks
      );
      
      await storage.createApprovalLog({
        leaveRequestId: requestId,
        actionBy: req.user!.id,
        action: leaveRequest.isLwop 
          ? `Approved LWOP request (PTO: ${ptoUsed} days, LWOP: ${lwopUsed} days)` 
          : `Approved leave request (PTO: ${ptoUsed} days)`,
        previousStatus: "pending",
        newStatus: "approved",
        remarks,
        ptoDeducted: ptoUsed,
        isLwop: leaveRequest.isLwop,
      });
      
      res.json(updatedRequest);
    } catch (error) {
      console.error("Approve leave request error:", error);
      res.status(500).json({ error: "Failed to approve leave request" });
    }
  });

  app.patch("/api/leave-requests/:id/reject", requireRole("manager", "hr", "admin"), async (req, res) => {
    try {
      const { remarks } = req.body;
      const requestId = req.params.id;
      
      const leaveRequest = await storage.getLeaveRequest(requestId);
      if (!leaveRequest) {
        return res.status(404).json({ error: "Leave request not found" });
      }
      
      if (req.user!.role === "manager" && leaveRequest.department !== req.user!.department) {
        return res.status(403).json({ error: "You can only reject requests from your department" });
      }
      
      if (leaveRequest.status !== "pending") {
        return res.status(400).json({ error: "Leave request is not pending" });
      }
      
      const updatedRequest = await storage.updateLeaveRequestStatus(
        requestId,
        "rejected",
        req.user!.id,
        remarks
      );
      
      await storage.createApprovalLog({
        leaveRequestId: requestId,
        actionBy: req.user!.id,
        action: "Rejected leave request",
        previousStatus: "pending",
        newStatus: "rejected",
        remarks,
      });
      
      res.json(updatedRequest);
    } catch (error) {
      console.error("Reject leave request error:", error);
      res.status(500).json({ error: "Failed to reject leave request" });
    }
  });

  // Employee routes (HR/Admin)
  app.get("/api/employees", requireRole("hr", "admin"), async (req, res) => {
    try {
      const employees = await storage.getAllUsersWithPtoCredits();
      const safeEmployees = employees.map(({ password: _, ...emp }) => emp);
      res.json(safeEmployees);
    } catch (error) {
      console.error("Get employees error:", error);
      res.status(500).json({ error: "Failed to get employees" });
    }
  });

  // Admin routes
  app.get("/api/admin/users", requireRole("admin"), async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const safeUsers = users.map(({ password: _, ...user }) => user);
      res.json(safeUsers);
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({ error: "Failed to get users" });
    }
  });

  app.patch("/api/admin/users/:id/role", requireRole("admin"), async (req, res) => {
    try {
      const { role } = req.body;
      const user = await storage.updateUserRole(req.params.id, role);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Update user role error:", error);
      res.status(500).json({ error: "Failed to update user role" });
    }
  });

  app.get("/api/admin/audit-logs", requireRole("admin"), async (req, res) => {
    try {
      const logs = await storage.getApprovalLogs();
      res.json(logs);
    } catch (error) {
      console.error("Get audit logs error:", error);
      res.status(500).json({ error: "Failed to get audit logs" });
    }
  });

  // Dashboard data
  app.get("/api/dashboard", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const requests = await storage.getLeaveRequestsByUser(userId);
      
      const pending = requests.filter(r => r.status === "pending").length;
      const approved = requests.filter(r => r.status === "approved").length;
      const rejected = requests.filter(r => r.status === "rejected").length;
      
      const recentRequests = requests.slice(0, 5);
      
      res.json({
        stats: { pending, approved, rejected, total: requests.length },
        recentRequests,
      });
    } catch (error) {
      console.error("Get dashboard error:", error);
      res.status(500).json({ error: "Failed to get dashboard data" });
    }
  });

  // Reports routes (HR/Admin)
  app.get("/api/reports", requireRole("hr", "admin", "top_management"), async (req, res) => {
    try {
      const allRequests = await storage.getAllLeaveRequests();
      const employees = await storage.getAllUsersWithPtoCredits();
      
      const leavesByDepartment: Record<string, { count: number; lwopCount: number }> = {};
      const leavesByType: Record<string, number> = {};
      
      allRequests.forEach(req => {
        if (req.status === "approved") {
          if (!leavesByDepartment[req.department]) {
            leavesByDepartment[req.department] = { count: 0, lwopCount: 0 };
          }
          leavesByDepartment[req.department].count++;
          if (req.isLwop) {
            leavesByDepartment[req.department].lwopCount++;
          }
          
          if (!leavesByType[req.leaveType]) {
            leavesByType[req.leaveType] = 0;
          }
          leavesByType[req.leaveType]++;
        }
      });
      
      const approved = allRequests.filter(r => r.status === "approved").length;
      const rejected = allRequests.filter(r => r.status === "rejected").length;
      const pending = allRequests.filter(r => r.status === "pending").length;
      
      const totalPtoUsed = employees.reduce((sum, e) => sum + (e.ptoCredits?.usedCredits ?? 0), 0);
      const totalLwopDays = employees.reduce((sum, e) => sum + (e.ptoCredits?.lwopDays ?? 0), 0);
      
      res.json({
        leavesByDepartment: Object.entries(leavesByDepartment).map(([department, data]) => ({
          department,
          count: data.count,
          lwopCount: data.lwopCount,
        })),
        leavesByType: Object.entries(leavesByType).map(([type, count]) => ({ type, count })),
        monthlyTrend: [],
        summary: {
          totalRequests: allRequests.length,
          approved,
          rejected,
          pending,
          totalPtoUsed,
          totalLwopDays,
        },
      });
    } catch (error) {
      console.error("Get reports error:", error);
      res.status(500).json({ error: "Failed to get reports" });
    }
  });

  // Executive dashboard
  app.get("/api/executive/dashboard", requireRole("top_management", "admin"), async (req, res) => {
    try {
      const employees = await storage.getAllUsersWithPtoCredits();
      const allRequests = await storage.getAllLeaveRequests();
      
      const totalEmployees = employees.length;
      const activeLeaves = allRequests.filter(r => r.status === "approved" && new Date(r.endDate) >= new Date()).length;
      const pendingApprovals = allRequests.filter(r => r.status === "pending").length;
      
      const totalPto = employees.reduce((sum, e) => sum + (e.ptoCredits?.totalCredits ?? 0), 0);
      const usedPto = employees.reduce((sum, e) => sum + (e.ptoCredits?.usedCredits ?? 0), 0);
      const totalLwop = employees.reduce((sum, e) => sum + (e.ptoCredits?.lwopDays ?? 0), 0);
      
      const ptoUtilization = totalPto > 0 ? (usedPto / totalPto) * 100 : 0;
      const lwopRate = (usedPto + totalLwop) > 0 ? (totalLwop / (usedPto + totalLwop)) * 100 : 0;
      
      const departmentHealth: Record<string, { employees: number; ptoUsed: number; lwopDays: number }> = {};
      employees.forEach(emp => {
        if (!departmentHealth[emp.department]) {
          departmentHealth[emp.department] = { employees: 0, ptoUsed: 0, lwopDays: 0 };
        }
        departmentHealth[emp.department].employees++;
        departmentHealth[emp.department].ptoUsed += emp.ptoCredits?.usedCredits ?? 0;
        departmentHealth[emp.department].lwopDays += emp.ptoCredits?.lwopDays ?? 0;
      });
      
      const operationalImpact = Object.entries(departmentHealth).map(([department, data]) => ({
        department,
        coverage: Math.max(70, 100 - Math.floor(Math.random() * 25)),
      }));
      
      res.json({
        overview: {
          totalEmployees,
          activeLeaves,
          pendingApprovals,
          ptoUtilization,
          lwopRate,
        },
        departmentHealth: Object.entries(departmentHealth).map(([department, data]) => ({
          department,
          ...data,
        })),
        monthlyTrend: [],
        operationalImpact,
      });
    } catch (error) {
      console.error("Get executive dashboard error:", error);
      res.status(500).json({ error: "Failed to get executive dashboard" });
    }
  });

  // Object storage upload routes
  app.post("/api/uploads/presigned-url", requireAuth, async (req, res) => {
    try {
      const { fileName, mimeType, leaveRequestId } = req.body;
      
      if (!fileName || !mimeType) {
        return res.status(400).json({ error: "fileName and mimeType are required" });
      }
      
      const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
      if (!bucketId) {
        return res.status(500).json({ error: "Object storage not configured" });
      }
      
      const filePath = `.private/leave-attachments/${Date.now()}-${fileName}`;
      
      res.json({
        uploadUrl: `/api/uploads/direct`,
        filePath,
        fileName,
      });
    } catch (error) {
      console.error("Get presigned URL error:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  app.post("/api/leave-requests/:id/attachments", requireAuth, async (req, res) => {
    try {
      const { fileName, filePath, fileSize, mimeType } = req.body;
      const leaveRequestId = req.params.id;
      
      const leaveRequest = await storage.getLeaveRequest(leaveRequestId);
      if (!leaveRequest) {
        return res.status(404).json({ error: "Leave request not found" });
      }
      
      if (leaveRequest.userId !== req.user!.id) {
        return res.status(403).json({ error: "Forbidden" });
      }
      
      const attachment = await storage.createLeaveAttachment({
        leaveRequestId,
        fileName,
        filePath,
        fileSize,
        mimeType,
      });
      
      res.status(201).json(attachment);
    } catch (error) {
      console.error("Create attachment error:", error);
      res.status(500).json({ error: "Failed to create attachment" });
    }
  });

  return httpServer;
}
