import type {
  ApiApplicationRole,
  ApiDashboardDocumentItemDto,
  ApiDocumentDto,
  ApiDocumentPriority,
  ApiDocumentStatus,
  ApiSearchResultItemDto,
  ApiUserSummaryDto,
  ApiWorkflowDto,
  ApiWorkflowStepDto,
  ApiWorkflowStepStatus,
} from "./types";
import type {
  ApprovalMode,
  ApprovalStep,
  Department,
  DocStatus,
  Document,
  Priority,
  Role,
  SlaState,
  User,
  Workflow,
  AppRole,
} from "@/lib/wdas/types";

function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
}

function mapDepartment(name: string): Department {
  const known: Department[] = ["Finance", "HR", "Procurement", "Legal", "Operations", "Information Technology"];
  return (known.find((d) => d === name) ?? name) as Department;
}

const API_ROLE_BY_VALUE: Record<number, ApiApplicationRole> = {
  1: "SuperAdmin",
  2: "DepartmentAdmin",
  3: "MakerOwner",
  4: "Approver",
  5: "Auditor",
  6: "ItAdmin",
};

export function mapApiRole(role: ApiApplicationRole | number): Role {
  const normalized =
    typeof role === "number"
      ? (API_ROLE_BY_VALUE[role] ?? "MakerOwner")
      : role;

  switch (normalized) {
    case "SuperAdmin":
      return "super_admin";
    case "DepartmentAdmin":
      return "dept_admin";
    case "MakerOwner":
      return "owner";
    case "Approver":
      return "approver";
    case "Auditor":
      return "auditor";
    default:
      return "owner";
  }
}

export function pickPrimaryRole(roles: Array<ApiApplicationRole | number>): Role {
  const normalized = roles.map(mapApiRole);
  const order: Role[] = ["super_admin", "dept_admin", "auditor", "approver", "owner"];
  for (const r of order) {
    if (normalized.includes(r)) return r;
  }
  return "owner";
}

function mapSingleAppRole(role: ApiApplicationRole | number): AppRole {
  switch (mapApiRole(role)) {
    case "super_admin":
      return "Super Admin";
    case "dept_admin":
      return "Dept Admin";
    case "approver":
      return "Approver";
    case "auditor":
      return "Auditor";
    default:
      return "Maker";
  }
}

export function mapAppRole(roles: Array<ApiApplicationRole | number>): AppRole {
  switch (pickPrimaryRole(roles)) {
    case "super_admin":
      return "Super Admin";
    case "dept_admin":
      return "Dept Admin";
    case "approver":
      return "Approver";
    case "auditor":
      return "Auditor";
    default:
      return "Maker";
  }
}

export function mapAppRoles(roles: Array<ApiApplicationRole | number>): AppRole[] {
  const seen = new Set<AppRole>();
  const mapped: AppRole[] = [];
  for (const role of roles) {
    if (typeof role === "number" && !API_ROLE_BY_VALUE[role]) continue;
    const appRole = mapSingleAppRole(role);
    if (!seen.has(appRole)) {
      seen.add(appRole);
      mapped.push(appRole);
    }
  }
  return mapped.length ? mapped : ["Maker"];
}

export function toApiApplicationRole(role: AppRole): ApiApplicationRole {
  switch (role) {
    case "Super Admin":
      return "SuperAdmin";
    case "Dept Admin":
      return "DepartmentAdmin";
    case "Approver":
      return "Approver";
    case "Auditor":
      return "Auditor";
    default:
      return "MakerOwner";
  }
}

function documentRefId(recordNumber?: number): string | undefined {
  if (recordNumber != null && recordNumber > 0) return String(recordNumber);
  return undefined;
}

export function mapUser(dto: ApiUserSummaryDto): User {
  return {
    id: dto.id,
    name: dto.displayName,
    designation: dto.title,
    department: mapDepartment(dto.departmentName),
    departmentId: dto.departmentId,
    email: dto.email,
    adId: dto.adObjectId,
    username: dto.userPrincipalName,
    status: dto.isActive === false ? "disabled" : "active",
    isActive: dto.isActive !== false,
    appRole: mapAppRole(dto.roles),
    appRoles: mapAppRoles(dto.roles),
  };
}

export function mapDocStatus(status: ApiDocumentStatus | string): DocStatus {
  switch (status) {
    case "Draft":
      return "draft";
    case "Submitted":
    case "InApproval":
      return "pending";
    case "ReadyForFinalization":
      return "ready_to_finalize";
    case "ReturnedForCorrection":
      return "returned";
    case "Rejected":
      return "rejected";
    case "Cancelled":
      return "cancelled";
    case "Finalized":
      return "approved";
    default:
      return "pending";
  }
}

function mapStepStatus(status: ApiWorkflowStepStatus): ApprovalStep["status"] {
  switch (status) {
    case "Approved":
      return "approved";
    case "Rejected":
      return "rejected";
    case "Returned":
      return "returned";
    case "Skipped":
      return "skipped";
    default:
      return "pending";
  }
}

function mapSla(classification: string, breached?: boolean): SlaState {
  if (breached || classification === "Overdue") return "overdue";
  if (classification === "AtRisk") return "at_risk";
  return "on_time";
}

function mapPriority(priority: ApiDocumentPriority): Priority {
  return priority;
}

function mapStep(step: ApiWorkflowStepDto): ApprovalStep {
  const actions = step.actions ?? [];
  const lastAction = actions[actions.length - 1];
  return {
    id: step.id,
    approverId: step.approverUserId ?? "",
    order: step.stepOrder,
    status: mapStepStatus(step.status),
    actedAt: step.completedAtUtc ?? lastAction?.actionAtUtc,
    comment: lastAction?.comment ?? undefined,
  };
}

function mapAttachmentType(fileName: string): import("@/lib/wdas/types").Attachment["type"] {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "xlsx" || ext === "xls") return "excel";
  if (ext === "pptx" || ext === "ppt") return "ppt";
  if (ext === "png" || ext === "jpg" || ext === "jpeg") return "image";
  return "word";
}

export function mapAttachment(dto: import("./types").ApiAttachmentDto): import("@/lib/wdas/types").Attachment {
  return {
    id: dto.id,
    name: dto.logicalName ?? dto.fileName,
    type: mapAttachmentType(dto.fileName),
    size: `${Math.round(dto.fileSizeBytes / 1024)} KB`,
    scanStatus: dto.scanStatus as import("@/lib/wdas/types").Attachment["scanStatus"],
  };
}

export function mapDocument(
  dto: ApiDocumentDto,
  attachments: import("@/lib/wdas/types").Attachment[] = [],
): Document {
  const workflowSteps = dto.workflowSteps ?? [];
  const steps = workflowSteps.map(mapStep);
  const activeStep = workflowSteps.find((s) => s.status === "Active");
  const submitted = dto.submittedAtUtc ?? workflowSteps[0]?.activatedAtUtc;
  const createdAt = submitted ?? new Date().toISOString();

  return {
    id: dto.id,
    subject: dto.subject,
    body: dto.bodyHtml,
    ownerId: dto.ownerUserId,
    ownerName: dto.ownerDisplayName,
    toIds: [],
    workflowId: dto.workflowId,
    amount: dto.amount ?? undefined,
    priority: mapPriority(dto.priority),
    status: mapDocStatus(dto.status),
    createdAt,
    submittedAt: dto.submittedAtUtc ?? undefined,
    daysPending: submitted ? daysSince(submitted) : 0,
    sla: mapSla(activeStep?.isSlaBreached ? "Overdue" : "OnTime", activeStep?.isSlaBreached),
    currentStepId: activeStep?.id,
    steps,
    attachments,
    refId: documentRefId(dto.recordNumber),
    recordNumber: dto.recordNumber,
    archiveDocumentId: dto.archiveDocumentId ?? undefined,
    finalizedAt: dto.finalizedAtUtc ?? undefined,
    cancelReason: dto.cancellationReason ?? undefined,
  };
}

export function mapDashboardItem(dto: ApiDashboardDocumentItemDto, ownerId?: string): Document {
  const submitted = dto.submittedAtUtc ?? new Date().toISOString();
  return {
    id: dto.documentId,
    refId: documentRefId(dto.recordNumber),
    recordNumber: dto.recordNumber,
    subject: dto.subject,
    body: "",
    ownerId: dto.ownerUserId ?? ownerId ?? "",
    toIds: [],
    workflowId: "",
    priority: "Normal",
    status: mapDocStatus(dto.status),
    createdAt: submitted,
    submittedAt: dto.submittedAtUtc ?? undefined,
    daysPending: dto.submittedAtUtc ? daysSince(dto.submittedAtUtc) : 0,
    sla: mapSla(dto.slaClassification, dto.isSlaBreached),
    currentStepId: dto.activeStepId ?? undefined,
    steps: [],
    attachments: [],
  };
}

export function mapSearchItem(dto: ApiSearchResultItemDto): Document {
  const submitted = dto.submittedAtUtc ?? new Date().toISOString();
  return {
    id: dto.documentId,
    refId: documentRefId(dto.recordNumber),
    recordNumber: dto.recordNumber,
    archiveDocumentId: dto.archiveDocumentId ?? undefined,
    subject: dto.subject,
    body: dto.snippet,
    ownerId: "",
    ownerName: dto.ownerDisplayName,
    toIds: [],
    workflowId: "",
    amount: dto.amount ?? undefined,
    priority: "Normal",
    status: mapDocStatus(dto.status),
    createdAt: submitted,
    submittedAt: dto.submittedAtUtc ?? undefined,
    daysPending: dto.submittedAtUtc ? daysSince(dto.submittedAtUtc) : 0,
    sla: "on_time",
    steps: [],
    attachments: [],
  };
}

export function mapWorkflow(dto: ApiWorkflowDto, departmentName?: string): Workflow {
  const mode = dto.activeVersion?.approvalMode;
  const approvalMode: ApprovalMode =
    mode === "Matrix" ? "matrix"
    : mode === "Group" ? "user"
    : mode === "AdHoc" ? "adhoc"
    : mode === "Hybrid" ? "hybrid"
    : "user";

  const financial = /purchase|financial|invoice|payment|expense/i.test(dto.documentType + dto.name);

  return {
    id: dto.id,
    name: dto.name,
    type: financial ? "financial" : "non_financial",
    description: dto.description ?? "",
    department: departmentName ? mapDepartment(departmentName) : undefined,
    documentType: dto.documentType,
    isActive: dto.isActive,
    status: !dto.isActive
      ? "archived"
      : dto.activeVersion?.state === "Active"
        ? "active"
        : "draft",
    version: dto.activeVersion?.versionNumber,
    mode: approvalMode,
    approvalSequence: dto.activeVersion?.approvalSequence === "Parallel" ? "parallel" : "sequential",
  };
}

export function toApiPriority(priority: Priority): ApiDocumentPriority {
  return priority;
}

export function toApiDocStatus(status: DocStatus): ApiDocumentStatus | undefined {
  switch (status) {
    case "draft":
      return "Draft";
    case "pending":
      return "InApproval";
    case "ready_to_finalize":
      return "ReadyForFinalization";
    case "returned":
      return "ReturnedForCorrection";
    case "rejected":
      return "Rejected";
    case "cancelled":
      return "Cancelled";
    case "approved":
      return "Finalized";
    default:
      return undefined;
  }
}
