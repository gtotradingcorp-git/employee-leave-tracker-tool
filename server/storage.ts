import { db } from "./db";
import { eq, and, desc, or, gte, lte, sql } from "drizzle-orm";
import {
  users,
  leaveRequests,
  ptoCredits,
  leaveAttachments,
  approvalLogs,
  departmentApprovers,
  type User,
  type InsertUser,
  type LeaveRequest,
  type InsertLeaveRequest,
  type PtoCredits,
  type InsertPtoCredits,
  type LeaveAttachment,
  type InsertLeaveAttachment,
  type ApprovalLog,
  type InsertApprovalLog,
  type DepartmentApprover,
  type InsertDepartmentApprover,
  type UserWithPtoCredits,
  type LeaveRequestWithUser,
  type DepartmentApproverWithUser,
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByEmployeeId(employeeId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserRole(userId: string, role: string): Promise<User | undefined>;
  completeUserProfile(userId: string, profile: { employeeId: string; department: string; position: string }): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  
  getUserWithPtoCredits(userId: string): Promise<UserWithPtoCredits | undefined>;
  getAllUsersWithPtoCredits(): Promise<UserWithPtoCredits[]>;
  
  getPtoCredits(userId: string): Promise<PtoCredits | undefined>;
  createPtoCredits(credits: InsertPtoCredits): Promise<PtoCredits>;
  updatePtoCredits(userId: string, used: number, lwop: number): Promise<PtoCredits | undefined>;
  
  getLeaveRequest(id: string): Promise<LeaveRequest | undefined>;
  getLeaveRequestWithUser(id: string): Promise<LeaveRequestWithUser | undefined>;
  createLeaveRequest(request: InsertLeaveRequest & { userId: string; totalDays: number; isLwop?: boolean }): Promise<LeaveRequest>;
  updateLeaveRequestStatus(
    id: string,
    status: string,
    approverId: string,
    remarks?: string
  ): Promise<LeaveRequest | undefined>;
  getLeaveRequestsByUser(userId: string): Promise<LeaveRequestWithUser[]>;
  getPendingLeaveRequests(department?: string): Promise<LeaveRequestWithUser[]>;
  getAllLeaveRequests(): Promise<LeaveRequestWithUser[]>;
  
  createLeaveAttachment(attachment: InsertLeaveAttachment): Promise<LeaveAttachment>;
  getLeaveAttachments(leaveRequestId: string): Promise<LeaveAttachment[]>;
  
  createApprovalLog(log: InsertApprovalLog): Promise<ApprovalLog>;
  getApprovalLogs(leaveRequestId?: string): Promise<ApprovalLog[]>;
  
  getDepartmentApprover(department: string): Promise<DepartmentApproverWithUser | undefined>;
  getDepartmentApprovers(department: string): Promise<DepartmentApproverWithUser[]>;
  getAllDepartmentApprovers(): Promise<DepartmentApproverWithUser[]>;
  setDepartmentApprover(department: string, approverUserId: string): Promise<DepartmentApprover>;
  addDepartmentApprover(department: string, approverUserId: string): Promise<DepartmentApprover>;
  removeDepartmentApprover(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByEmployeeId(employeeId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.employeeId, employeeId));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUserRole(userId: string, role: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ role: role as any })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async completeUserProfile(
    userId: string,
    profile: { employeeId: string; department: string; position: string }
  ): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({
        employeeId: profile.employeeId,
        department: profile.department as any,
        position: profile.position,
        isProfileComplete: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(users.fullName);
  }

  async getUserWithPtoCredits(userId: string): Promise<UserWithPtoCredits | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) return undefined;
    
    const [credits] = await db.select().from(ptoCredits).where(eq(ptoCredits.userId, userId));
    return { ...user, ptoCredits: credits || undefined };
  }

  async getAllUsersWithPtoCredits(): Promise<UserWithPtoCredits[]> {
    const allUsers = await db.select().from(users).orderBy(users.fullName);
    const allCredits = await db.select().from(ptoCredits);
    
    const creditsMap = new Map(allCredits.map(c => [c.userId, c]));
    
    return allUsers.map(user => ({
      ...user,
      ptoCredits: creditsMap.get(user.id),
    }));
  }

  async getPtoCredits(userId: string): Promise<PtoCredits | undefined> {
    const [credits] = await db.select().from(ptoCredits).where(eq(ptoCredits.userId, userId));
    return credits;
  }

  async createPtoCredits(insertCredits: InsertPtoCredits): Promise<PtoCredits> {
    const [credits] = await db.insert(ptoCredits).values(insertCredits).returning();
    return credits;
  }

  async updatePtoCredits(userId: string, usedCredits: number, lwopDays: number): Promise<PtoCredits | undefined> {
    const [credits] = await db
      .update(ptoCredits)
      .set({ usedCredits, lwopDays, updatedAt: new Date() })
      .where(eq(ptoCredits.userId, userId))
      .returning();
    return credits;
  }

  async getLeaveRequest(id: string): Promise<LeaveRequest | undefined> {
    const [request] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, id));
    return request;
  }

  async getLeaveRequestWithUser(id: string): Promise<LeaveRequestWithUser | undefined> {
    const [request] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, id));
    if (!request) return undefined;
    
    const [user] = await db.select().from(users).where(eq(users.id, request.userId));
    const attachmentsList = await db.select().from(leaveAttachments).where(eq(leaveAttachments.leaveRequestId, id));
    
    let approver: User | undefined;
    if (request.approverId) {
      const [approverUser] = await db.select().from(users).where(eq(users.id, request.approverId));
      approver = approverUser;
    }
    
    return { ...request, user, approver, attachments: attachmentsList };
  }

  async createLeaveRequest(insertRequest: InsertLeaveRequest & { userId: string; totalDays: number; isLwop?: boolean }): Promise<LeaveRequest> {
    const [request] = await db.insert(leaveRequests).values({
      ...insertRequest,
      isLwop: insertRequest.isLwop ?? false,
    }).returning();
    return request;
  }

  async updateLeaveRequestStatus(
    id: string,
    status: string,
    approverId: string,
    remarks?: string
  ): Promise<LeaveRequest | undefined> {
    const [request] = await db
      .update(leaveRequests)
      .set({
        status: status as any,
        approverId,
        approverRemarks: remarks,
        approvedAt: new Date(),
      })
      .where(eq(leaveRequests.id, id))
      .returning();
    return request;
  }

  async getLeaveRequestsByUser(userId: string): Promise<LeaveRequestWithUser[]> {
    const requests = await db
      .select()
      .from(leaveRequests)
      .where(eq(leaveRequests.userId, userId))
      .orderBy(desc(leaveRequests.filedAt));
    
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    
    const result: LeaveRequestWithUser[] = [];
    for (const request of requests) {
      const attachmentsList = await db.select().from(leaveAttachments).where(eq(leaveAttachments.leaveRequestId, request.id));
      let approver: User | undefined;
      if (request.approverId) {
        const [approverUser] = await db.select().from(users).where(eq(users.id, request.approverId));
        approver = approverUser;
      }
      result.push({ ...request, user, approver, attachments: attachmentsList });
    }
    
    return result;
  }

  async getPendingLeaveRequests(department?: string): Promise<LeaveRequestWithUser[]> {
    let requests;
    if (department) {
      requests = await db
        .select()
        .from(leaveRequests)
        .where(and(eq(leaveRequests.status, "pending"), eq(leaveRequests.department, department as any)))
        .orderBy(desc(leaveRequests.filedAt));
    } else {
      requests = await db
        .select()
        .from(leaveRequests)
        .where(eq(leaveRequests.status, "pending"))
        .orderBy(desc(leaveRequests.filedAt));
    }
    
    const result: LeaveRequestWithUser[] = [];
    for (const request of requests) {
      const [user] = await db.select().from(users).where(eq(users.id, request.userId));
      const attachmentsList = await db.select().from(leaveAttachments).where(eq(leaveAttachments.leaveRequestId, request.id));
      result.push({ ...request, user, attachments: attachmentsList });
    }
    
    return result;
  }

  async getAllLeaveRequests(): Promise<LeaveRequestWithUser[]> {
    const requests = await db
      .select()
      .from(leaveRequests)
      .orderBy(desc(leaveRequests.filedAt));
    
    const result: LeaveRequestWithUser[] = [];
    for (const request of requests) {
      const [user] = await db.select().from(users).where(eq(users.id, request.userId));
      const attachmentsList = await db.select().from(leaveAttachments).where(eq(leaveAttachments.leaveRequestId, request.id));
      let approver: User | undefined;
      if (request.approverId) {
        const [approverUser] = await db.select().from(users).where(eq(users.id, request.approverId));
        approver = approverUser;
      }
      result.push({ ...request, user, approver, attachments: attachmentsList });
    }
    
    return result;
  }

  async createLeaveAttachment(insertAttachment: InsertLeaveAttachment): Promise<LeaveAttachment> {
    const [attachment] = await db.insert(leaveAttachments).values(insertAttachment).returning();
    return attachment;
  }

  async getLeaveAttachments(leaveRequestId: string): Promise<LeaveAttachment[]> {
    return await db
      .select()
      .from(leaveAttachments)
      .where(eq(leaveAttachments.leaveRequestId, leaveRequestId));
  }

  async createApprovalLog(insertLog: InsertApprovalLog): Promise<ApprovalLog> {
    const [log] = await db.insert(approvalLogs).values(insertLog).returning();
    return log;
  }

  async getApprovalLogs(leaveRequestId?: string): Promise<ApprovalLog[]> {
    if (leaveRequestId) {
      return await db
        .select()
        .from(approvalLogs)
        .where(eq(approvalLogs.leaveRequestId, leaveRequestId))
        .orderBy(desc(approvalLogs.createdAt));
    }
    return await db
      .select()
      .from(approvalLogs)
      .orderBy(desc(approvalLogs.createdAt))
      .limit(100);
  }

  async getDepartmentApprover(department: string): Promise<DepartmentApproverWithUser | undefined> {
    const [approver] = await db
      .select()
      .from(departmentApprovers)
      .where(eq(departmentApprovers.department, department as any));
    
    if (!approver) return undefined;
    
    const [user] = await db.select().from(users).where(eq(users.id, approver.approverUserId));
    if (!user) return undefined;
    
    return { ...approver, approver: user };
  }

  async getAllDepartmentApprovers(): Promise<DepartmentApproverWithUser[]> {
    const allApprovers = await db.select().from(departmentApprovers);
    
    const result: DepartmentApproverWithUser[] = [];
    for (const approver of allApprovers) {
      const [user] = await db.select().from(users).where(eq(users.id, approver.approverUserId));
      if (user) {
        result.push({ ...approver, approver: user });
      }
    }
    
    return result;
  }

  async setDepartmentApprover(department: string, approverUserId: string): Promise<DepartmentApprover> {
    const existing = await db
      .select()
      .from(departmentApprovers)
      .where(eq(departmentApprovers.department, department as any));
    
    if (existing.length > 0) {
      const [updated] = await db
        .update(departmentApprovers)
        .set({ approverUserId, updatedAt: new Date() })
        .where(eq(departmentApprovers.department, department as any))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(departmentApprovers)
        .values({ department: department as any, approverUserId })
        .returning();
      return created;
    }
  }

  async getDepartmentApprovers(department: string): Promise<DepartmentApproverWithUser[]> {
    const approvers = await db
      .select()
      .from(departmentApprovers)
      .where(eq(departmentApprovers.department, department as any));
    
    const result: DepartmentApproverWithUser[] = [];
    for (const approver of approvers) {
      const [user] = await db.select().from(users).where(eq(users.id, approver.approverUserId));
      if (user) {
        result.push({ ...approver, approver: user });
      }
    }
    
    return result;
  }

  async addDepartmentApprover(department: string, approverUserId: string): Promise<DepartmentApprover> {
    // Check if this exact combination already exists
    const existing = await db
      .select()
      .from(departmentApprovers)
      .where(
        and(
          eq(departmentApprovers.department, department as any),
          eq(departmentApprovers.approverUserId, approverUserId)
        )
      );
    
    if (existing.length > 0) {
      return existing[0];
    }
    
    const [created] = await db
      .insert(departmentApprovers)
      .values({ department: department as any, approverUserId })
      .returning();
    return created;
  }

  async removeDepartmentApprover(id: string): Promise<void> {
    await db.delete(departmentApprovers).where(eq(departmentApprovers.id, id));
  }
}

export const storage = new DatabaseStorage();
