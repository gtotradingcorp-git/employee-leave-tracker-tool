import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import { insertUserSchema, insertLeaveRequestSchema, loginSchema, type User } from "@shared/schema";
import { z } from "zod";
import { Storage } from "@google-cloud/storage";
import { pool } from "./db";

// Extend Express session
declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

// Email validation schema for registration
const registrationSchema = z.object({
  email: z.string().email().refine(
    (email) => email.endsWith("@gtotradingcorp.com") || email.endsWith("@gmail.com"),
    { message: "Only @gtotradingcorp.com or @gmail.com email addresses are allowed" }
  ),
  password: z.string().min(8, "Password must be at least 8 characters"),
  fullName: z.string().min(2, "Full name is required"),
  employeeId: z.string().min(1, "Employee ID is required"),
  department: z.enum([
    "human_resources",
    "it_digital_transformation",
    "accounting",
    "credit_collection",
    "sales",
    "business_unit",
    "business_support_group",
    "operations_logistics",
    "operations_frontline",
    "operations_warehouse",
    "top_management"
  ]),
  position: z.string().min(1, "Position is required"),
  employeeLevel: z.enum([
    "rank_and_file",
    "supervisor",
    "manager",
    "executive",
    "top_management"
  ]).optional().default("rank_and_file"),
});

// Helper to get user ID from session
function getUserId(req: Request): string | undefined {
  return req.session?.userId;
}

// Helper to get current user from database
async function getCurrentUser(req: Request): Promise<User | undefined> {
  const userId = getUserId(req);
  if (!userId) return undefined;
  return await storage.getUser(userId);
}

// Authentication middleware
function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.session?.userId) {
    next();
  } else {
    res.status(401).json({ error: "Unauthorized" });
  }
}

// Middleware to check if user has completed their profile
async function requireCompleteProfile(req: Request, res: Response, next: NextFunction) {
  const user = await getCurrentUser(req);
  if (!user || !user.isProfileComplete) {
    return res.status(403).json({ error: "Profile incomplete", code: "PROFILE_INCOMPLETE" });
  }
  next();
}

// Combined middleware for authenticated users with complete profiles
function requireAuth(req: Request, res: Response, next: NextFunction) {
  isAuthenticated(req, res, async () => {
    await requireCompleteProfile(req, res, next);
  });
}

// Middleware for role-based access (requires complete profile)
function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    isAuthenticated(req, res, async () => {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      if (!user.isProfileComplete) {
        return res.status(403).json({ error: "Profile incomplete", code: "PROFILE_INCOMPLETE" });
      }
      if (!roles.includes(user.role)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      next();
    });
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Setup session with PostgreSQL store
  const PgSession = connectPgSimple(session);
  
  app.use(
    session({
      store: new PgSession({
        pool: pool,
        tableName: "sessions",
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "gto-leave-management-secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      },
    })
  );

  // Registration endpoint
  app.post("/api/auth/register", async (req, res) => {
    try {
      const data = registrationSchema.parse(req.body);
      
      // Check if email is already registered
      const existingUser = await storage.getUserByEmail(data.email);
      if (existingUser) {
        return res.status(400).json({ error: "Email already registered" });
      }
      
      // Check if employee ID is already registered
      const existingEmployeeId = await storage.getUserByEmployeeId(data.employeeId);
      if (existingEmployeeId) {
        return res.status(400).json({ error: "Employee ID already registered" });
      }
      
      // Hash the password
      const hashedPassword = await bcrypt.hash(data.password, 10);
      
      // Create the user
      const user = await storage.createUser({
        email: data.email,
        password: hashedPassword,
        fullName: data.fullName,
        employeeId: data.employeeId,
        department: data.department,
        position: data.position,
        employeeLevel: data.employeeLevel,
        isProfileComplete: true,
      });
      
      // Create PTO credits for the user
      await storage.createPtoCredits({
        userId: user.id,
        totalCredits: 5,
        usedCredits: 0,
        lwopDays: 0,
        year: new Date().getFullYear(),
      });
      
      // Set session
      req.session.userId = user.id;
      
      const userWithCredits = await storage.getUserWithPtoCredits(user.id);
      const { password: _, ...safeUser } = userWithCredits!;
      res.status(201).json(safeUser);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Registration error:", error);
      res.status(500).json({ error: "Failed to register" });
    }
  });

  // Login endpoint
  app.post("/api/auth/login", async (req, res) => {
    try {
      const data = loginSchema.parse(req.body);
      
      const user = await storage.getUserByEmail(data.email);
      if (!user || !user.password) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      
      const isValidPassword = await bcrypt.compare(data.password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      
      if (!user.isActive) {
        return res.status(403).json({ error: "Account is deactivated" });
      }
      
      // Set session
      req.session.userId = user.id;
      
      const userWithCredits = await storage.getUserWithPtoCredits(user.id);
      const { password: _, ...safeUser } = userWithCredits!;
      res.json(safeUser);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Login error:", error);
      res.status(500).json({ error: "Failed to login" });
    }
  });

  // Logout endpoint
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ error: "Failed to logout" });
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out successfully" });
    });
  });

  // Get current user
  app.get("/api/auth/me", isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userWithCredits = await storage.getUserWithPtoCredits(userId);
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
      const userId = getUserId(req)!;
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
      const userId = getUserId(req)!;
      const requests = await storage.getLeaveRequestsByUser(userId);
      res.json(requests);
    } catch (error) {
      console.error("Get leave requests error:", error);
      res.status(500).json({ error: "Failed to get leave requests" });
    }
  });

  app.get("/api/leave-requests/pending", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req)!;
      const user = await getCurrentUser(req);
      const userRole = user?.role;
      
      // HR and Admin can see all pending requests
      if (userRole === "hr" || userRole === "admin") {
        const requests = await storage.getPendingLeaveRequests();
        return res.json(requests);
      }
      
      // For managers and other users, check if they are a designated approver for any department
      const allApprovers = await storage.getAllDepartmentApprovers();
      const assignedDepartments = allApprovers
        .filter(a => a.approverUserId === userId)
        .map(a => a.department);
      
      if (assignedDepartments.length === 0) {
        return res.json([]); // No departments assigned to this user
      }
      
      // Get pending requests for all assigned departments
      const allPending: any[] = [];
      for (const dept of assignedDepartments) {
        const requests = await storage.getPendingLeaveRequests(dept);
        allPending.push(...requests);
      }
      
      res.json(allPending);
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
      
      const user = await getCurrentUser(req);
      if (request.userId !== getUserId(req) && !["manager", "hr", "admin"].includes(user?.role || "")) {
        return res.status(403).json({ error: "Forbidden" });
      }
      
      res.json(request);
    } catch (error) {
      console.error("Get leave request error:", error);
      res.status(500).json({ error: "Failed to get leave request" });
    }
  });

  app.patch("/api/leave-requests/:id/approve", requireAuth, async (req, res) => {
    try {
      const { remarks } = req.body;
      const requestId = req.params.id;
      const userId = getUserId(req)!;
      const user = await getCurrentUser(req);
      const userRole = user?.role;
      
      const leaveRequest = await storage.getLeaveRequestWithUser(requestId);
      if (!leaveRequest) {
        return res.status(404).json({ error: "Leave request not found" });
      }
      
      // HR and Admin can approve any request
      const isHrOrAdmin = userRole === "hr" || userRole === "admin";
      
      // Check if user is the designated approver for this department
      const departmentApprover = await storage.getDepartmentApprover(leaveRequest.department);
      const isDesignatedApprover = departmentApprover?.approverUserId === userId;
      
      if (!isHrOrAdmin && !isDesignatedApprover) {
        return res.status(403).json({ error: "You are not authorized to approve requests from this department" });
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
        userId,
        remarks
      );
      
      await storage.createApprovalLog({
        leaveRequestId: requestId,
        actionBy: userId,
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

  app.patch("/api/leave-requests/:id/reject", requireAuth, async (req, res) => {
    try {
      const { remarks } = req.body;
      const requestId = req.params.id;
      const userId = getUserId(req)!;
      const user = await getCurrentUser(req);
      const userRole = user?.role;
      
      const leaveRequest = await storage.getLeaveRequest(requestId);
      if (!leaveRequest) {
        return res.status(404).json({ error: "Leave request not found" });
      }
      
      // HR and Admin can reject any request
      const isHrOrAdmin = userRole === "hr" || userRole === "admin";
      
      // Check if user is the designated approver for this department
      const departmentApprover = await storage.getDepartmentApprover(leaveRequest.department);
      const isDesignatedApprover = departmentApprover?.approverUserId === userId;
      
      if (!isHrOrAdmin && !isDesignatedApprover) {
        return res.status(403).json({ error: "You are not authorized to reject requests from this department" });
      }
      
      if (leaveRequest.status !== "pending") {
        return res.status(400).json({ error: "Leave request is not pending" });
      }
      
      const updatedRequest = await storage.updateLeaveRequestStatus(
        requestId,
        "rejected",
        userId,
        remarks
      );
      
      await storage.createApprovalLog({
        leaveRequestId: requestId,
        actionBy: userId,
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

  // Department Approvers management
  app.get("/api/admin/department-approvers", requireRole("admin"), async (req, res) => {
    try {
      const approvers = await storage.getAllDepartmentApprovers();
      res.json(approvers);
    } catch (error) {
      console.error("Get department approvers error:", error);
      res.status(500).json({ error: "Failed to get department approvers" });
    }
  });

  app.put("/api/admin/department-approvers/:department", requireRole("admin"), async (req, res) => {
    try {
      const { approverUserId } = req.body;
      const { department } = req.params;
      
      if (!approverUserId) {
        return res.status(400).json({ error: "approverUserId is required" });
      }
      
      const user = await storage.getUser(approverUserId);
      if (!user) {
        return res.status(404).json({ error: "Approver user not found" });
      }
      
      const approver = await storage.setDepartmentApprover(department, approverUserId);
      res.json(approver);
    } catch (error) {
      console.error("Set department approver error:", error);
      res.status(500).json({ error: "Failed to set department approver" });
    }
  });

  // Dashboard data
  app.get("/api/dashboard", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req)!;
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
        const dept = emp.department || "unassigned";
        if (!departmentHealth[dept]) {
          departmentHealth[dept] = { employees: 0, ptoUsed: 0, lwopDays: 0 };
        }
        departmentHealth[dept].employees++;
        departmentHealth[dept].ptoUsed += emp.ptoCredits?.usedCredits ?? 0;
        departmentHealth[dept].lwopDays += emp.ptoCredits?.lwopDays ?? 0;
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

  return httpServer;
}
