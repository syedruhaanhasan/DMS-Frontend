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

/** API entity IDs are strings in JSON but may arrive as numbers in edge cases. */
function apiId(value: string | number | null | undefined): string {
  return value == null ? "" : String(value);
}

function apiIdOpt(value: string | number | null | undefined): string | undefined {
  return value == null ? undefined : String(value);
}

function mapDepartment(name: string | null | undefined): Department {
  const safe = (name ?? "").trim() || "—";
  const known: Department[] = ["Finance", "HR", "Procurement", "Legal", "Operations", "Information Technology"];
  return (known.find((d) => d === safe) ?? safe) as Department;
}

const API_ROLE_BY_VALUE: Record<number, ApiApplicationRole> = {
  1: "SuperAdmin",
  2: "DepartmentAdmin",
  3: "MakerOwner",
  4: "Approver",
  5: "Auditor",
  6: "ItAdmin",
};

export function mapApiRole(role: ApiApplicationRole | number | string | { code?: string }): Role {
  const normalized =
    typeof role === "number"
      ? (API_ROLE_BY_VALUE[role] ?? "MakerOwner")
      : typeof role === "object" && role && "code" in role
        ? String(role.code ?? "MakerOwner")
        : String(role);

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

export function pickPrimaryRole(roles: Array<ApiApplicationRole | number | string | { code?: string }>): Role {
  const normalized = roles.map(mapApiRole);
  const order: Role[] = ["super_admin", "dept_admin", "auditor", "approver", "owner"];
  for (const r of order) {
    if (normalized.includes(r)) return r;
  }
  return "owner";
}

function mapSingleAppRole(role: ApiApplicationRole | number | string | { code?: string; name?: string }): AppRole {
  if (typeof role === "object" && role?.name) {
    const name = role.name;
    if (name === "Super Admin" || name === "Dept Admin" || name === "Maker" || name === "Approver" || name === "Auditor") {
      return name === "Maker" ? "Maker" : name as AppRole;
    }
  }
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

export function mapAppRole(roles: Array<ApiApplicationRole | number | string | { code?: string; name?: string }>): AppRole {
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

export function mapAppRoles(roles: Array<ApiApplicationRole | number | string | { code?: string; name?: string }>): AppRole[] {
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
  const roleIds = Array.isArray(dto.roles)
    ? dto.roles
        .map((r) => (typeof r === "object" && r && "id" in r ? String((r as { id: string }).id) : null))
        .filter((id): id is string => !!id)
    : [];

  return {
    id: apiId(dto.id),
    name: dto.displayName,
    designation: dto.title,
    department: mapDepartment(dto.departmentName),
    departmentId: apiId(dto.departmentId),
    email: dto.email,
    phone: dto.phoneNumber ?? undefined,
    adId: dto.adObjectId,
    username: dto.userPrincipalName,
    status: dto.isActive === false ? "disabled" : "active",
    isActive: dto.isActive !== false,
    appRole: mapAppRole(dto.roles as never),
    appRoles: mapAppRoles(dto.roles as never),
    roleIds,
    permissions: dto.permissions ?? [],
    userTypeId: dto.userTypeId ?? undefined,
    userTypeName: dto.userTypeName ?? undefined,
  };
}

export function mapDocStatus(status: ApiDocumentStatus | string): DocStatus {
  switch (status) {
    case "Draft":
      return "draft";
    case "PendingReviewerReview":
      return "pending_reviewer";
    case "PendingCreatorApproval":
      return "pending_creator_send";
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
      return "draft";
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
    id: apiId(step.id),
    approverId: apiId(step.approverUserId),
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
    id: apiId(dto.id),
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
    id: apiId(dto.id),
    subject: dto.subject,
    body: dto.bodyHtml,
    ownerId: apiId(dto.ownerUserId),
    ownerName: dto.ownerDisplayName,
    toIds: (dto.adHocApproverUserIds ?? []).map(apiId),
    workflowId: apiId(dto.workflowId),
    amount: dto.amount ?? undefined,
    priority: mapPriority(dto.priority),
    status: mapDocStatus(dto.status),
    createdAt,
    submittedAt: dto.submittedAtUtc ?? undefined,
    daysPending: submitted ? daysSince(submitted) : 0,
    sla: mapSla(activeStep?.isSlaBreached ? "Overdue" : "OnTime", activeStep?.isSlaBreached),
    currentStepId: apiIdOpt(activeStep?.id),
    steps,
    attachments,
    reviewers: (dto.recipients ?? []).map((r) => ({
      id: apiId(r.id),
      name: r.recipientName,
      email: r.recipientEmail ?? undefined,
      userId: r.reviewerUserId ? apiId(r.reviewerUserId) : undefined,
      addedById: r.addedById ? apiId(r.addedById) : undefined,
      reviewedAt: r.reviewedAtUtc ?? undefined,
      reviewComment: r.reviewComment ?? undefined,
    })),
    refId: documentRefId(dto.recordNumber),
    recordNumber: dto.recordNumber,
    revisionNumber: dto.revisionNumber && dto.revisionNumber > 0 ? dto.revisionNumber : 1,
    archiveDocumentId: dto.archiveDocumentId ?? undefined,
    finalizedAt: dto.finalizedAtUtc ?? undefined,
    cancelReason: dto.cancellationReason ?? undefined,
  };
}

export function mapDashboardItem(dto: ApiDashboardDocumentItemDto, ownerId?: string): Document {
  const submitted = dto.submittedAtUtc ?? new Date().toISOString();
  return {
    id: apiId(dto.documentId),
    refId: documentRefId(dto.recordNumber),
    recordNumber: dto.recordNumber,
    subject: dto.subject,
    body: "",
    ownerId: apiId(dto.ownerUserId ?? ownerId),
    toIds: [],
    workflowId: "",
    priority: "Normal",
    status: mapDocStatus(dto.status),
    createdAt: submitted,
    submittedAt: dto.submittedAtUtc ?? undefined,
    daysPending: dto.submittedAtUtc ? daysSince(dto.submittedAtUtc) : 0,
    sla: mapSla(dto.slaClassification, dto.isSlaBreached),
    currentStepId: apiIdOpt(dto.activeStepId),
    steps: [],
    attachments: [],
    reviewers: [],
    seenByApprover: dto.activeStepSeenByApprover ?? false,
  };
}

export function mapSearchItem(dto: ApiSearchResultItemDto): Document {
  const submitted = dto.submittedAtUtc ?? new Date().toISOString();
  return {
    id: apiId(dto.documentId),
    refId: documentRefId(dto.recordNumber),
    recordNumber: dto.recordNumber,
    archiveDocumentId: dto.archiveDocumentId ?? undefined,
    subject: dto.subject,
    body: dto.snippet,
    ownerId: apiId(dto.ownerUserId),
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
    reviewers: [],
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
    id: apiId(dto.id),
    name: dto.name,
    type: financial ? "financial" : "non_financial",
    description: dto.description ?? "",
    department: departmentName ? mapDepartment(departmentName) : undefined,
    documentType: dto.documentType,
    isActive: dto.isActive,
    status: dto.activeVersion?.state === "Active"
      ? "active"
      : dto.activeVersion?.state === "Draft" || dto.activeVersion?.state === "TestPreview"
        ? "pending"
        : !dto.isActive
          ? "archived"
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
    case "pending_reviewer":
      return "PendingReviewerReview";
    case "pending_creator_send":
      return "PendingCreatorApproval";
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
