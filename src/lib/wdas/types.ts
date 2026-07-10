export type Role =
  | "super_admin"
  | "dept_admin"
  | "owner"
  | "approver"
  | "auditor";

export type Department = "Finance" | "HR" | "Procurement" | "Legal" | "Operations" | "Information Technology";
export const DEPARTMENTS: Department[] = ["Finance", "HR", "Procurement", "Legal", "Operations", "Information Technology"];

export type DocStatus =
  | "draft"
  | "pending"
  | "ready_to_finalize"
  | "approved"
  | "rejected"
  | "returned"
  | "cancelled";

export type SlaState = "on_time" | "at_risk" | "overdue";
export type Priority = "Normal" | "Urgent" | "Critical";

/** Application role — how the user acts inside WDAS (distinct from Session Role). */
export type AppRole = "Maker" | "Approver" | "Dept Admin" | "Auditor" | "Super Admin";
export const APP_ROLES: AppRole[] = ["Maker", "Approver", "Dept Admin", "Auditor", "Super Admin"];

export type UserStatus = "active" | "disabled";

export interface User {
  id: string;
  name: string;
  designation: string;
  department: Department;
  departmentId?: string;
  managerId?: string;
  email: string;
  adId?: string;
  username?: string;
  appRole?: AppRole;
  appRoles?: AppRole[];
  status?: UserStatus;
  isActive?: boolean;
}

/* ================= Configuration types ================= */

export type ApprovalMode = "matrix" | "user" | "adhoc" | "hybrid";
export type ApprovalSequence = "sequential" | "parallel";

export interface MatrixBand {
  id: string;
  min: number;
  max: number | null; // null = "and above"
  approverGroupIds: string[];
  sequence: "sequential" | "parallel";
}

export interface ApproverGroup {
  id: string;
  name: string;
  memberIds: string[];
  rule: "any" | "all";
}

export interface SlaRule {
  reminderHours: number;
  escalationHours: number;
  escalationUserId?: string;
}

export interface NotificationSettings {
  submit: { email: boolean; inApp: boolean; sms: boolean };
  approve: { email: boolean; inApp: boolean; sms: boolean };
  reject: { email: boolean; inApp: boolean; sms: boolean };
  reminder: { email: boolean; inApp: boolean; sms: boolean };
}

export type WorkflowStatus = "active" | "draft" | "archived";

export interface WorkflowVersion {
  version: number;
  publishedAt: string;
  publishedBy: string;
  note?: string;
}

export interface Workflow {
  id: string;
  name: string;
  type: "financial" | "non_financial";
  description: string;
  // config-only fields (optional for backward compat)
  department?: Department;
  documentType?: string;
  status?: WorkflowStatus;
  isActive?: boolean;
  version?: number;
  mode?: ApprovalMode;
  approvalSequence?: ApprovalSequence;
  defaultToIds?: string[];
  approverUserIds?: string[];
  matrixBands?: MatrixBand[];
  groups?: ApproverGroup[];
  hybridFinalOwnerChoice?: boolean;
  sla?: SlaRule;
  notifications?: NotificationSettings;
  returnResumePolicy?: "RestartFromFirst" | "ResumeAfterReturningStep";
  versionHistory?: WorkflowVersion[];
}

export interface ApprovalStep {
  id: string;
  approverId: string;
  order: number;
  status: "pending" | "approved" | "rejected" | "returned" | "skipped";
  actedAt?: string;
  comment?: string;
  attachmentName?: string;
  delegateFromId?: string; // if action was taken by delegate
  reassignedFromId?: string; // if step was force-reassigned
  reassignReason?: string;
}

export interface Attachment {
  id: string;
  name: string;
  type: "pdf" | "word" | "excel" | "ppt" | "image";
  size: string;
  scanStatus?: "Pending" | "Clean" | "Quarantined";
}

export interface Document {
  id: string;
  refId?: string;
  recordNumber?: number;
  archiveDocumentId?: string;
  subject: string;
  body: string;
  ownerId: string;
  ownerName?: string;
  toIds: string[];
  workflowId: string;
  amount?: number;
  priority: Priority;
  status: DocStatus;
  createdAt: string;
  submittedAt?: string;
  finalizedAt?: string;
  daysPending: number;
  sla: SlaState;
  currentStepId?: string;
  steps: ApprovalStep[];
  attachments: Attachment[];
  cancelReason?: string;
}

/* ============== External approvers & Delegation ============== */

export type OtpStatus = "pending" | "verified" | "expired";

export interface ExternalApprover {
  id: string;
  name: string;
  email: string;
  documentId?: string;
  documentSubject?: string;
  linkSentAt: string;
  linkExpiresAt: string;
  otpStatus: OtpStatus;
  ipAddress?: string;
  actionTaken?: "approved" | "rejected" | "pending";
}

export interface Delegation {
  id: string;
  fromUserId: string;
  toUserId: string;
  startAt: string; // ISO
  endAt: string;
  active: boolean;
  createdAt: string;
}

export interface DocumentTypeCatalogItem {
  id: string;
  name: string;
  code: string;
  description?: string;
  category: "financial" | "non_financial";
  amountRequired: boolean;
  isActive: boolean;
}
