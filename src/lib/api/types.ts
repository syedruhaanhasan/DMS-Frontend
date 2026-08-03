/** Backend DTO mirrors (ASP.NET Core default JSON uses camelCase). */

export type ApiApplicationRole =
  | "SuperAdmin"
  | "DepartmentAdmin"
  | "MakerOwner"
  | "Approver"
  | "Auditor"
  | "ItAdmin";

export type ApiDocumentStatus =
  | "Draft"
  | "Submitted"
  | "InApproval"
  | "ReturnedForCorrection"
  | "Rejected"
  | "ReadyForFinalization"
  | "Cancelled"
  | "Finalized"
  | "PendingReviewerReview"
  | "PendingCreatorApproval";

export type ApiDocumentPriority = "Normal" | "Urgent" | "Critical";

export type ApiWorkflowStepStatus =
  | "Pending"
  | "Active"
  | "Approved"
  | "Rejected"
  | "Returned"
  | "Skipped";

export type ApiWorkflowActionType = "Approve" | "Reject" | "Return" | "Comment" | "Reassign";

export type ApiApprovalMode = "Matrix" | "Group" | "AdHoc" | "Hybrid";

export interface ApiAssignedRoleDto {
  id: string;
  name: string;
  code: string;
}

export interface ApiUserSummaryDto {
  id: string;
  adObjectId: string;
  userPrincipalName: string;
  displayName: string;
  email: string;
  phoneNumber?: string | null;
  title: string;
  departmentId: string;
  departmentName: string;
  roles: ApiAssignedRoleDto[] | Array<ApiApplicationRole | number>;
  permissions?: string[];
  isActive: boolean;
  userTypeId?: string | null;
  userTypeName?: string | null;
}

export interface ApiSecurityRoleSummaryDto {
  id: string;
  name: string;
  code: string;
  isSystem: boolean;
  isActive: boolean;
  permissionCount: number;
}

export interface ApiSecurityRoleDetailDto {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  isSystem: boolean;
  isActive: boolean;
  permissions: string[];
}

export interface ApiPermissionDefinitionDto {
  key: string;
  group: string;
  label: string;
}

export interface ApiDepartmentDto {
  id: string;
  name: string;
  code: string;
  parentDepartmentId: string | null;
  isActive: boolean;
}

export interface ApiDocumentTypeDto {
  id: string;
  name: string;
  code: string;
  description: string | null;
  category: "financial" | "non_financial" | string;
  amountRequired: boolean;
  isActive: boolean;
}

export interface ApiUserTypeDto {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
}

export interface ApiLoginResponse {
  accessToken: string;
  expiresAtUtc: string;
  user: ApiUserSummaryDto;
}

export interface ApiAuditLogEntryDto {
  sequenceNumber: number;
  eventType: string;
  action: string;
  actorUserId: string | null;
  actorDisplayName: string | null;
  documentId: string | null;
  entityType: string | null;
  entityId: string | null;
  detailsJson: string | null;
  ipAddress: string | null;
  createdAtUtc: string;
  entryHash: string;
}

export interface ApiAuditExportResult {
  entries: ApiAuditLogEntryDto[];
  chainValid: boolean;
  chainValidationMessage: string | null;
}

export interface ApiAuditExportRequest {
  documentId?: string | null;
  departmentId?: string | null;
  fromUtc?: string | null;
  toUtc?: string | null;
}

export interface ApiWorkflowVersionSummaryDto {
  id: string;
  versionNumber: number;
  state: string;
  approvalMode: ApiApprovalMode;
  approvalSequence?: "Sequential" | "Parallel" | string;
  returnResumePolicy: string;
  slaThresholdHours: number | null;
  escalationEnabled: boolean;
}

export interface ApiWorkflowDto {
  id: string;
  departmentId: string;
  name: string;
  documentType: string;
  description: string | null;
  isActive: boolean;
  activeVersion: ApiWorkflowVersionSummaryDto | null;
}

export interface ApiWorkflowRoutingDto {
  id: string;
  approvalMode: ApiApprovalMode;
  approvalSequence: "Sequential" | "Parallel";
  approverUserIds: string[];
  groups: ApiApproverGroupDto[];
  matrixTiers: ApiMatrixTierDto[];
}

export interface ApiWorkflowStepActionDto {
  id: string;
  actorUserId: string;
  actorDisplayName: string;
  actionType: ApiWorkflowActionType;
  comment: string | null;
  actionAtUtc: string;
}

export interface ApiWorkflowStepDto {
  id: string;
  stepOrder: number;
  approverUserId: string | null;
  approverDisplayName: string | null;
  groupName: string | null;
  status: ApiWorkflowStepStatus;
  activatedAtUtc: string | null;
  completedAtUtc: string | null;
  slaDueAtUtc: string | null;
  isSlaBreached: boolean;
  actions: ApiWorkflowStepActionDto[];
}

export interface ApiDocumentRecipientDto {
  id: string;
  recipientName: string;
  recipientEmail: string | null;
  reviewerUserId?: string | null;
  addedById?: string | null;
  reviewedAtUtc?: string | null;
  reviewComment?: string | null;
}

export interface ApiDocumentDto {
  id: string;
  recordNumber: number;
  revisionNumber?: number;
  ownerUserId: string;
  ownerDisplayName: string;
  departmentId: string;
  workflowId: string;
  workflowVersionId: string | null;
  toRecipients: string;
  fromDisplay: string;
  subject: string;
  bodyHtml: string;
  amount: number | null;
  priority: ApiDocumentPriority;
  status: ApiDocumentStatus;
  isBodyLocked: boolean;
  submittedAtUtc: string | null;
  archiveDocumentId: string | null;
  finalizedAtUtc: string | null;
  cancellationReason: string | null;
  adHocApproverUserIds?: string[] | null;
  downloadAllowedUserIds?: string[] | null;
  recipients: ApiDocumentRecipientDto[];
  workflowSteps: ApiWorkflowStepDto[];
}

export interface ApiDashboardDocumentItemDto {
  documentId: string;
  recordNumber: number;
  ownerUserId?: string;
  subject: string;
  status: string;
  workflowName: string;
  submittedAtUtc: string | null;
  dueAtUtc: string | null;
  isSlaBreached: boolean;
  slaClassification: string;
  activeStepId: string | null;
  isDelegated?: boolean;
  activeStepSeenByApprover?: boolean;
}

export interface ApiPersonalDashboardDto {
  pendingMyApproval: ApiDashboardDocumentItemDto[];
  delegatedPendingApproval: ApiDashboardDocumentItemDto[];
  myDocuments: ApiDashboardDocumentItemDto[];
  recentlyCompleted: ApiDashboardDocumentItemDto[];
}

export interface ApiDepartmentDashboardDto {
  departmentId: string;
  departmentName: string;
  documents: ApiDashboardDocumentItemDto[];
}

export interface ApiSuccessMetricsDto {
  averageCycleTimeDays: number;
  adoptionRatePercent: number;
  slaBreachCount: number;
  auditExportCount: number;
  slaCompliancePercent: number;
  activeUsersLast30Days: number;
  documentsSubmittedLast30Days: number;
}

export interface ApiHistoryActionDto {
  actionType: string;
  actorUserId: string;
  actorDisplayName: string;
  comment: string | null;
  actionAtUtc: string;
  stepApproverUserId?: string | null;
}

export interface ApiSearchResultItemDto {
  documentId: string;
  recordNumber: number;
  archiveDocumentId: string | null;
  subject: string;
  ownerDisplayName: string;
  ownerUserId: string;
  status: string;
  amount: number | null;
  submittedAtUtc: string | null;
  snippet: string;
  actions?: ApiHistoryActionDto[] | null;
}

export interface ApiSearchResultDto {
  totalCount: number;
  items: ApiSearchResultItemDto[];
}

export interface ApiDelegationDto {
  id: string;
  approverUserId: string;
  approverDisplayName: string;
  delegateUserId: string;
  delegateDisplayName: string;
  startsAtUtc: string;
  endsAtUtc: string;
  isActive: boolean;
  reason: string | null;
}

export interface ApiExternalApproverSessionDto {
  id: string;
  workflowStepId: string;
  approverEmail: string;
  linkExpiresAtUtc: string;
  secureLinkToken: string;
}

export interface ApiSyncResultDto {
  usersSynced: number;
  departmentsSynced: number;
  syncedAtUtc: string;
  source: string;
}

export interface ApiApprovalTimeReportDto {
  departmentId: string;
  departmentName: string;
  workflowName: string;
  averageEndToEndHours: number;
  averageStepHours: number;
  documentCount: number;
}

export interface ApiBottleneckReportDto {
  approverDisplayName: string;
  approverUserId: string;
  stepCount: number;
  averageDelayHours: number;
  overdueCount: number;
}

export interface ApiVolumeTrendReportDto {
  period: string;
  submittedCount: number;
  approvedCount: number;
  rejectedCount: number;
  rejectionRate: number;
}

export interface ApiRepositoryDocumentDto {
  id: string;
  archiveDocumentId: string;
  sourceDocumentId: string;
  subject: string;
  bodyHtmlSnapshot: string;
  approvalTrailJson: string;
  finalizedAtUtc: string;
  finalizedByDisplayName: string;
  hasArchivePdf: boolean;
}

export interface ApiExternalSessionDto {
  accessToken: string;
  workflowStepId: string;
  documentId: string;
  expiresAtUtc: string;
}

export interface ApiAttachmentDto {
  id: string;
  documentId: string;
  fileName: string;
  logicalName: string | null;
  contentType: string;
  fileSizeBytes: number;
  versionNumber: number;
  isLatest: boolean;
  scanStatus: string;
  downloadRestricted: boolean;
  createdAtUtc: string;
}

export interface ApiNotificationDto {
  id: string;
  eventType: string;
  channel: string;
  subject: string;
  body: string;
  documentId: string | null;
  createdAtUtc: string;
  readAtUtc: string | null;
}

export interface ApiExternalApproverListItemDto {
  id: string;
  workflowStepId: string;
  documentId: string;
  documentSubject: string;
  approverName: string;
  approverEmail: string;
  linkSentAtUtc: string;
  linkExpiresAtUtc: string;
  otpVerified: boolean;
  isRevoked: boolean;
  actionTaken: string;
}

export interface ApiMatrixTierDto {
  id: string;
  sequenceOrder: number;
  minAmount: number;
  maxAmount: number | null;
  approverUserIds: string[];
}

export interface ApiApproverGroupDto {
  id: string;
  name: string;
  sequenceOrder: number;
  requirement: "AnyOneMember" | "AllMembers";
  memberUserIds: string[];
}
