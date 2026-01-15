import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, date, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum("user_role", [
  "employee",
  "manager",
  "hr",
  "admin",
  "top_management"
]);

export const departmentEnum = pgEnum("department", [
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
]);

export const employeeLevelEnum = pgEnum("employee_level", [
  "rank_and_file",
  "supervisor",
  "manager",
  "executive",
  "top_management"
]);

export const leaveTypeEnum = pgEnum("leave_type", [
  "vacation",
  "sick",
  "emergency",
  "bereavement",
  "maternity",
  "paternity",
  "indefinite"
]);

export const leaveStatusEnum = pgEnum("leave_status", [
  "pending",
  "approved",
  "rejected",
  "cancelled"
]);

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  employeeId: text("employee_id").notNull().unique(),
  department: departmentEnum("department").notNull(),
  position: text("position").notNull(),
  employeeLevel: employeeLevelEnum("employee_level").notNull().default("rank_and_file"),
  role: userRoleEnum("role").notNull().default("employee"),
  supervisorId: varchar("supervisor_id"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  supervisor: one(users, {
    fields: [users.supervisorId],
    references: [users.id],
    relationName: "supervisor"
  }),
  subordinates: many(users, { relationName: "supervisor" }),
  leaveRequests: many(leaveRequests),
  approvedRequests: many(leaveRequests, { relationName: "approver" }),
  ptoCredits: one(ptoCredits),
}));

// PTO Credits table
export const ptoCredits = pgTable("pto_credits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique().references(() => users.id),
  totalCredits: integer("total_credits").notNull().default(5),
  usedCredits: integer("used_credits").notNull().default(0),
  lwopDays: integer("lwop_days").notNull().default(0),
  year: integer("year").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const ptoCreditsRelations = relations(ptoCredits, ({ one }) => ({
  user: one(users, {
    fields: [ptoCredits.userId],
    references: [users.id],
  }),
}));

// Leave Requests table
export const leaveRequests = pgTable("leave_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  leaveType: leaveTypeEnum("leave_type").notNull(),
  department: departmentEnum("department").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  totalDays: integer("total_days").notNull(),
  reason: text("reason").notNull(),
  status: leaveStatusEnum("status").notNull().default("pending"),
  isLwop: boolean("is_lwop").notNull().default(false),
  approverId: varchar("approver_id").references(() => users.id),
  approverRemarks: text("approver_remarks"),
  approvedAt: timestamp("approved_at"),
  filedAt: timestamp("filed_at").notNull().defaultNow(),
});

export const leaveRequestsRelations = relations(leaveRequests, ({ one, many }) => ({
  user: one(users, {
    fields: [leaveRequests.userId],
    references: [users.id],
  }),
  approver: one(users, {
    fields: [leaveRequests.approverId],
    references: [users.id],
    relationName: "approver"
  }),
  attachments: many(leaveAttachments),
  auditLogs: many(approvalLogs),
}));

// Leave Attachments table
export const leaveAttachments = pgTable("leave_attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leaveRequestId: varchar("leave_request_id").notNull().references(() => leaveRequests.id),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type").notNull(),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
});

export const leaveAttachmentsRelations = relations(leaveAttachments, ({ one }) => ({
  leaveRequest: one(leaveRequests, {
    fields: [leaveAttachments.leaveRequestId],
    references: [leaveRequests.id],
  }),
}));

// Approval Logs table (audit trail)
export const approvalLogs = pgTable("approval_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leaveRequestId: varchar("leave_request_id").notNull().references(() => leaveRequests.id),
  actionBy: varchar("action_by").notNull().references(() => users.id),
  action: text("action").notNull(),
  previousStatus: leaveStatusEnum("previous_status"),
  newStatus: leaveStatusEnum("new_status"),
  remarks: text("remarks"),
  ptoDeducted: integer("pto_deducted"),
  isLwop: boolean("is_lwop").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const approvalLogsRelations = relations(approvalLogs, ({ one }) => ({
  leaveRequest: one(leaveRequests, {
    fields: [approvalLogs.leaveRequestId],
    references: [leaveRequests.id],
  }),
  actor: one(users, {
    fields: [approvalLogs.actionBy],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
}).extend({
  email: z.string().email().refine(
    (email) => email.endsWith("@gtotradingcorp.com"),
    { message: "Only @gtotradingcorp.com email addresses are allowed" }
  ),
  password: z.string().min(8, "Password must be at least 8 characters"),
  fullName: z.string().min(2, "Full name is required"),
  employeeId: z.string().min(1, "Employee ID is required"),
  position: z.string().min(1, "Position is required"),
});

export const insertLeaveRequestSchema = createInsertSchema(leaveRequests).omit({
  id: true,
  status: true,
  isLwop: true,
  approverId: true,
  approverRemarks: true,
  approvedAt: true,
  filedAt: true,
}).extend({
  reason: z.string().min(10, "Please provide a detailed reason (at least 10 characters)"),
  startDate: z.string(),
  endDate: z.string(),
});

export const insertPtoCreditsSchema = createInsertSchema(ptoCredits).omit({
  id: true,
  updatedAt: true,
});

export const insertLeaveAttachmentSchema = createInsertSchema(leaveAttachments).omit({
  id: true,
  uploadedAt: true,
});

export const insertApprovalLogSchema = createInsertSchema(approvalLogs).omit({
  id: true,
  createdAt: true,
});

// Login schema
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertLeaveRequest = z.infer<typeof insertLeaveRequestSchema>;
export type LeaveRequest = typeof leaveRequests.$inferSelect;
export type InsertPtoCredits = z.infer<typeof insertPtoCreditsSchema>;
export type PtoCredits = typeof ptoCredits.$inferSelect;
export type InsertLeaveAttachment = z.infer<typeof insertLeaveAttachmentSchema>;
export type LeaveAttachment = typeof leaveAttachments.$inferSelect;
export type InsertApprovalLog = z.infer<typeof insertApprovalLogSchema>;
export type ApprovalLog = typeof approvalLogs.$inferSelect;
export type LoginInput = z.infer<typeof loginSchema>;

// Extended types for frontend
export type LeaveRequestWithUser = LeaveRequest & {
  user: User;
  approver?: User;
  attachments?: LeaveAttachment[];
};

export type UserWithPtoCredits = User & {
  ptoCredits?: PtoCredits;
};

// Constants
export const DEPARTMENTS = [
  { value: "human_resources", label: "Human Resources (HR)" },
  { value: "it_digital_transformation", label: "IT & Digital Transformation" },
  { value: "accounting", label: "Accounting" },
  { value: "credit_collection", label: "Credit & Collection" },
  { value: "sales", label: "Sales" },
  { value: "business_unit", label: "Business Unit" },
  { value: "business_support_group", label: "Business Support Group" },
  { value: "operations_logistics", label: "Operations (Logistics)" },
  { value: "operations_frontline", label: "Operations (Frontline)" },
  { value: "operations_warehouse", label: "Operations (Warehouse)" },
  { value: "top_management", label: "Top Management" },
] as const;

export const LEAVE_TYPES = [
  { value: "vacation", label: "Vacation Leave" },
  { value: "sick", label: "Sick Leave" },
  { value: "emergency", label: "Emergency Leave" },
  { value: "bereavement", label: "Bereavement Leave" },
  { value: "maternity", label: "Maternity Leave" },
  { value: "paternity", label: "Paternity Leave" },
  { value: "indefinite", label: "Indefinite Leave" },
] as const;

export const EMPLOYEE_LEVELS = [
  { value: "rank_and_file", label: "Rank-and-File" },
  { value: "supervisor", label: "Supervisor" },
  { value: "manager", label: "Manager" },
  { value: "executive", label: "Executive" },
  { value: "top_management", label: "Top Management" },
] as const;

export const USER_ROLES = [
  { value: "employee", label: "Employee" },
  { value: "manager", label: "Department Manager" },
  { value: "hr", label: "HR Department" },
  { value: "admin", label: "IT Administrator" },
  { value: "top_management", label: "Top Management" },
] as const;
