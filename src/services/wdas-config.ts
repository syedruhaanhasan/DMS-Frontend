import { api } from "@/lib/api/client";
import type {
  ApiApproverGroupDto,
  ApiDelegationDto,
  ApiDocumentTypeDto,
  ApiExternalApproverListItemDto,
  ApiExternalApproverSessionDto,
  ApiMatrixTierDto,
  ApiSyncResultDto,
  ApiUserSummaryDto,
  ApiWorkflowDto,
  ApiWorkflowVersionSummaryDto,
} from "@/lib/api/types";
import { mapUser, mapWorkflow, toApiApplicationRole } from "@/lib/api/mappers";
import type {
  AppRole,
  Delegation,
  Department,
  ExternalApprover,
  User,
  UserStatus,
  Workflow,
  DocumentTypeCatalogItem,
} from "@/lib/wdas/types";
import type { ApiApprovalMode } from "@/lib/api/types";

type ApiDepartment = { id: string; name: string; code: string; parentDepartmentId: string | null; isActive: boolean };

function withIsActiveQuery(path: string, isActive?: boolean): string {
  if (isActive === undefined) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}isActive=${isActive}`;
}

async function resolveDepartmentId(departmentName?: Department): Promise<string> {
  const departments = await api.get<ApiDepartment[]>(withIsActiveQuery("/api/departments", true));
  if (!departmentName) {
    const fallback = departments.find((d) => d.isActive) ?? departments[0];
    if (!fallback) throw new Error("No department available. Create a department under Configuration first.");
    return fallback.id;
  }

  const dept = departments.find((d) => d.name === departmentName);
  if (!dept) {
    throw new Error(
      `Department "${departmentName}" is not configured. Choose a department from the list or create it under Configuration → Departments.`,
    );
  }

  return dept.id;
}

function normalizeApprovalMode(mode?: ApprovalMode | "group"): ApprovalMode {
  if (mode === "group") return "user";
  return mode ?? "user";
}

function buildGroupsPayload(w: Workflow) {
  const mode = normalizeApprovalMode(w.mode);
  if (!w.groups?.length || !(mode === "hybrid" || mode === "matrix")) {
    return undefined;
  }

  return w.groups.map((g, i) => ({
    name: g.name,
    sequenceOrder: i + 1,
    requirement: g.rule === "any" ? "AnyOneMember" : "AllMembers",
    memberUserIds: g.memberIds,
  }));
}

function buildMatrixPayload(w: Workflow) {
  const mode = normalizeApprovalMode(w.mode);
  if (!w.matrixBands?.length || !(mode === "matrix" || mode === "hybrid")) {
    return undefined;
  }

  const groupsById = new Map((w.groups ?? []).map((g) => [g.id, g]));
  return w.matrixBands.map((b, i) => ({
    sequenceOrder: i + 1,
    minAmount: b.min,
    maxAmount: b.max,
    approverUserIds: b.approverGroupIds.flatMap((gid) => groupsById.get(gid)?.memberIds ?? []),
  }));
}

function findWorkflowDuplicate(
  workflows: Workflow[],
  input: { name: string; documentType: string; department?: Department },
): Workflow | undefined {
  const name = input.name.trim();
  const documentType = input.documentType.trim();
  if (!name || !documentType) return undefined;

  return workflows.find(
    (w) =>
      w.department === input.department &&
      w.documentType?.trim() === documentType &&
      w.name?.trim() === name,
  );
}

function mapDelegation(dto: ApiDelegationDto): Delegation {
  return {
    id: dto.id,
    fromUserId: dto.approverUserId,
    toUserId: dto.delegateUserId,
    startAt: dto.startsAtUtc,
    endAt: dto.endsAtUtc,
    active: dto.isActive,
    createdAt: dto.startsAtUtc,
  };
}
export const wdasConfig = {
  listUsers: async (filter?: { department?: Department | "all"; query?: string; status?: UserStatus; isActive?: boolean }): Promise<User[]> => {
    const isActive =
      filter?.isActive ??
      (filter?.status === "active" ? true : filter?.status === "disabled" ? false : undefined);
    const rows = (await api.get<ApiUserSummaryDto[]>(withIsActiveQuery("/api/users", isActive))).map(mapUser);
    let list = [...rows];

    if (filter?.department && filter.department !== "all") {
      list = list.filter((u) => u.department === filter.department);
    }
    if (filter?.status) {
      list = list.filter((u) => (u.status ?? "active") === filter.status);
    }
    if (filter?.query) {
      const q = filter.query.toLowerCase();
      list = list.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.adId ?? "").toLowerCase().includes(q) ||
          u.designation.toLowerCase().includes(q),
      );
    }
    return list;
  },

  syncDirectory: async () => {
    const res = await api.post<ApiSyncResultDto>("/api/auth/sync");
    return { updated: res.usersSynced, disabled: 0, added: 0 };
  },

  updateUserRoles: async (userId: string, appRoles: AppRole[]) => {
    const dto = await api.put<ApiUserSummaryDto>(`/api/users/${userId}/role`, {
      roles: appRoles.map(toApiApplicationRole),
    });
    return mapUser(dto);
  },

  deleteUser: async (userId: string) => {
    await api.delete(`/api/users/${userId}`);
  },

  setUserActiveStatus: async (userId: string, isActive: boolean) => {
    const dto = await api.put<ApiUserSummaryDto>(`/api/users/${userId}/status`, { isActive });
    return mapUser(dto);
  },

  listDepartments: async (isActive?: boolean) => api.get<ApiDepartment[]>(withIsActiveQuery("/api/departments", isActive)),

  createDepartment: async (input: { name: string; code: string; parentDepartmentId?: string | null }) => {
    return api.post<{ id: string; name: string; code: string; parentDepartmentId: string | null; isActive: boolean }>("/api/departments", {
      name: input.name,
      code: input.code,
      parentDepartmentId: input.parentDepartmentId ?? null,
    });
  },

  updateDepartment: async (departmentId: string, input: { name?: string; code?: string; isActive?: boolean }) => {
    return api.put<ApiDepartment>(`/api/departments/${departmentId}`, input);
  },

  deleteDepartment: async (departmentId: string) => {
    await api.delete(`/api/departments/${departmentId}`);
  },

  listDocumentTypes: async (query?: string, isActive?: boolean): Promise<DocumentTypeCatalogItem[]> => {
    const params = new URLSearchParams();
    if (query?.trim()) params.set("query", query.trim());
    if (isActive !== undefined) params.set("isActive", String(isActive));
    const qs = params.toString() ? `?${params.toString()}` : "";
    const rows = await api.get<ApiDocumentTypeDto[]>(`/api/document-types${qs}`);
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      code: row.code,
      description: row.description ?? undefined,
      category: row.category === "financial" ? "financial" : "non_financial",
      amountRequired: row.amountRequired,
      isActive: row.isActive,
    }));
  },

  createDocumentType: async (input: {
    name: string;
    code: string;
    description?: string;
    category?: "financial" | "non_financial";
    amountRequired?: boolean;
  }) => {
    const dto = await api.post<ApiDocumentTypeDto>("/api/document-types", {
      name: input.name,
      code: input.code,
      description: input.description ?? null,
      category: input.category ?? "non_financial",
      amountRequired: input.amountRequired,
    });
    return {
      id: dto.id,
      name: dto.name,
      code: dto.code,
      description: dto.description ?? undefined,
      category: dto.category === "financial" ? "financial" as const : "non_financial" as const,
      amountRequired: dto.amountRequired,
      isActive: dto.isActive,
    };
  },

  updateDocumentType: async (
    documentTypeId: string,
    input: {
      name?: string;
      description?: string;
      category?: "financial" | "non_financial";
      amountRequired?: boolean;
      isActive?: boolean;
    },
  ) => {
    const dto = await api.put<ApiDocumentTypeDto>(`/api/document-types/${documentTypeId}`, {
      name: input.name,
      description: input.description ?? null,
      category: input.category,
      amountRequired: input.amountRequired,
      isActive: input.isActive,
    });
    return {
      id: dto.id,
      name: dto.name,
      code: dto.code,
      description: dto.description ?? undefined,
      category: dto.category === "financial" ? "financial" as const : "non_financial" as const,
      amountRequired: dto.amountRequired,
      isActive: dto.isActive,
    };
  },

  deleteDocumentType: async (documentTypeId: string) => {
    await api.delete(`/api/document-types/${documentTypeId}`);
  },

  deleteWorkflow: async (workflowId: string) => {
    await api.delete(`/api/workflows/${workflowId}`);
  },

  setWorkflowActiveStatus: async (workflowId: string, isActive: boolean) => {
    const dto = await api.put<ApiWorkflowDto>(`/api/workflows/${workflowId}/status`, { isActive });
    const departments = await api.get<{ id: string; name: string }[]>("/api/departments");
    const deptName = departments.find((d) => d.id === dto.departmentId)?.name;
    return mapWorkflow(dto, deptName);
  },

  createUser: async (input: {
    username: string;
    password?: string;
    displayName: string;
    email: string;
    title: string;
    departmentId: string;
    roles: AppRole[];
    accountType: "local" | "ad";
    adObjectId?: string;
  }) => {
    const dto = await api.post<ApiUserSummaryDto>("/api/users", {
      userPrincipalName: input.username,
      password: input.accountType === "local" ? input.password : null,
      displayName: input.displayName,
      email: input.email,
      title: input.title,
      departmentId: input.departmentId,
      roles: input.roles.map(toApiApplicationRole),
      accountType: input.accountType === "ad" ? "ActiveDirectory" : "Local",
      adObjectId: input.accountType === "ad" ? input.adObjectId : null,
    });
    return mapUser(dto);
  },

  listWorkflows: async (department?: Department | "all", isActive?: boolean): Promise<Workflow[]> => {
    const [rows, departments] = await Promise.all([
      api.get<ApiWorkflowDto[]>(withIsActiveQuery("/api/workflows", isActive)),
      api.get<ApiDepartment[]>("/api/departments"),
    ]);
    const deptById = new Map(departments.map((d) => [d.id, d.name]));
    const mapped = rows.map((w) => mapWorkflow(w, deptById.get(w.departmentId)));

    if (!department || department === "all") return mapped;

    return mapped.filter((w) => !w.department || w.department === department);
  },

  getWorkflow: async (id: string): Promise<Workflow> => {
    const [rows, departments, groups, tiers] = await Promise.all([
      api.get<ApiWorkflowDto[]>("/api/workflows"),
      api.get<{ id: string; name: string }[]>("/api/departments"),
      api.get<ApiApproverGroupDto[]>(`/api/workflows/${id}/approver-groups`).catch(() => [] as ApiApproverGroupDto[]),
      api.get<ApiMatrixTierDto[]>(`/api/workflows/${id}/matrix-tiers`).catch(() => [] as ApiMatrixTierDto[]),
    ]);
    const w = rows.find((x) => x.id === id);
    if (!w) throw new Error("Workflow not found");
    const deptName = departments.find((d) => d.id === w.departmentId)?.name;
    const mappedGroups = groups.map((g) => ({
      id: g.id,
      name: g.name,
      memberIds: g.memberUserIds,
      rule: (g.requirement === "AnyOneMember" ? "any" : "all") as import("@/lib/wdas/types").ApproverGroup["rule"],
    }));
    const mapped = mapWorkflow(w, deptName);
    const approverUserIds = (mapped.mode === "user" || mapped.mode === "hybrid")
      ? groups
          .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
          .flatMap((g) => g.memberUserIds)
      : undefined;

    return {
      ...mapped,
      approverUserIds,
      groups: mappedGroups,
      matrixBands: tiers.map((t) => ({
        id: t.id,
        min: Number(t.minAmount),
        max: t.maxAmount != null ? Number(t.maxAmount) : null,
        approverGroupIds: mappedGroups
          .filter((g) => g.memberIds.some((uid) => t.approverUserIds.includes(uid)))
          .map((g) => g.id),
        sequence: "sequential" as const,
      })),
    };
  },

  createWorkflow: async (w: Workflow) => {
    const departmentId = await resolveDepartmentId(w.department);
    const name = w.name.trim();
    const documentType = (w.documentType ?? w.name.replace(/\s+/g, "")).trim();

    const mode = normalizeApprovalMode(w.mode);
    const modeMap: Record<ApprovalMode, ApiApprovalMode> = {
      matrix: "Matrix",
      user: "AdHoc",
      adhoc: "AdHoc",
      hybrid: "Hybrid",
    };

    const sequenceMap = { sequential: "Sequential", parallel: "Parallel" } as const;

    const dto = await api.post<ApiWorkflowDto>("/api/workflows", {
      departmentId,
      name,
      documentType,
      description: w.description?.trim() || null,
      approvalMode: modeMap[mode],
      approvalSequence: sequenceMap[w.approvalSequence ?? "sequential"],
      returnResumePolicy: "RestartFromFirst",
      slaThresholdHours: w.sla?.escalationHours ?? 48,
      escalationEnabled: true,
      notificationSettingsJson: w.notifications ? JSON.stringify(w.notifications) : null,
      groups: buildGroupsPayload(w) ?? null,
      matrixTiers: buildMatrixPayload(w) ?? null,
    });

    return mapWorkflow(dto);
  },

  applyWorkflowConfiguration: async (workflowId: string, w: Workflow) => {
    const groups = buildGroupsPayload(w);
    const tiers = buildMatrixPayload(w);

    if (groups?.length) {
      await api.post<ApiApproverGroupDto[]>(`/api/workflows/${workflowId}/approver-groups`, { groups });
    }

    if (tiers?.length) {
      await api.post<ApiMatrixTierDto[]>(`/api/workflows/${workflowId}/matrix-tiers`, { tiers });
    }
  },

  findWorkflowDuplicate,

  /** Create workflow (active v1) in a single request, including groups/matrix when configured. */
  createAndPublishWorkflow: async (w: Workflow) => {
    const workflows = await wdasConfig.listWorkflows("all");
    const existing = findWorkflowDuplicate(workflows, {
      name: w.name,
      documentType: w.documentType ?? "",
      department: w.department,
    });

    if (existing) {
      await wdasConfig.applyWorkflowConfiguration(existing.id, w);
      return wdasConfig.getWorkflow(existing.id);
    }

    const created = await wdasConfig.createWorkflow(w);
    return wdasConfig.getWorkflow(created.id);
  },

  publishWorkflowVersion: async (id: string, changes: Partial<Workflow>, _publishedBy: string, _note?: string) => {
    const current = await wdasConfig.getWorkflow(id);
    const merged = { ...current, ...changes };

    const mergedMode = normalizeApprovalMode(merged.mode);
    const modeMap: Record<ApprovalMode, ApiApprovalMode> = {
      matrix: "Matrix",
      user: "AdHoc",
      adhoc: "AdHoc",
      hybrid: "Hybrid",
    };

    if (merged.groups?.length && (mergedMode === "hybrid" || mergedMode === "matrix")) {
      await api.post<ApiApproverGroupDto[]>(`/api/workflows/${id}/approver-groups`, {
        groups: merged.groups.map((g, i) => ({
          name: g.name,
          sequenceOrder: i + 1,
          requirement: g.rule === "any" ? "AnyOneMember" : "AllMembers",
          memberUserIds: g.memberIds,
        })),
      });
    }

    if (merged.matrixBands?.length && (mergedMode === "matrix" || mergedMode === "hybrid")) {
      const groupsById = new Map((merged.groups ?? []).map((g) => [g.id, g]));
      await api.post<ApiMatrixTierDto[]>(`/api/workflows/${id}/matrix-tiers`, {
        tiers: merged.matrixBands.map((b, i) => ({
          sequenceOrder: i + 1,
          minAmount: b.min,
          maxAmount: b.max,
          approverUserIds: b.approverGroupIds.flatMap((gid) => groupsById.get(gid)?.memberIds ?? []),
        })),
      });
    }

    const sequenceMap = { sequential: "Sequential", parallel: "Parallel" } as const;

    const dto = await api.put<ApiWorkflowDto>(`/api/workflows/${id}`, {
      name: merged.name,
      description: merged.description || null,
      approvalMode: modeMap[mergedMode],
      approvalSequence: sequenceMap[merged.approvalSequence ?? "sequential"],
      returnResumePolicy: merged.returnResumePolicy ?? "RestartFromFirst",
      slaThresholdHours: merged.sla?.escalationHours ?? 48,
      escalationEnabled: true,
      targetState: "Active",
      notificationSettingsJson: merged.notifications ? JSON.stringify(merged.notifications) : null,
    });

    return mapWorkflow(dto);
  },

  getWorkflowVersions: async (id: string): Promise<ApiWorkflowVersionSummaryDto[]> =>
    api.get<ApiWorkflowVersionSummaryDto[]>(`/api/workflows/${id}/versions`),

  getMatrixTiers: async (id: string) => api.get<ApiMatrixTierDto[]>(`/api/workflows/${id}/matrix-tiers`),

  getApproverGroups: async (id: string) => api.get<ApiApproverGroupDto[]>(`/api/workflows/${id}/approver-groups`),

  listExternalApprovers: async (): Promise<ExternalApprover[]> => {
    const rows = await api.get<ApiExternalApproverListItemDto[]>("/api/external-approvers");
    return rows.map((e) => ({
      id: e.id,
      name: e.approverName,
      email: e.approverEmail,
      documentId: e.documentId,
      documentSubject: e.documentSubject,
      linkSentAt: e.linkSentAtUtc,
      linkExpiresAt: e.linkExpiresAtUtc,
      otpStatus: e.otpVerified ? "verified" : new Date(e.linkExpiresAtUtc) < new Date() ? "expired" : "pending",
      actionTaken: e.actionTaken as ExternalApprover["actionTaken"],
    }));
  },

  addExternalApprover: async (name: string, email: string, _documentSubject?: string) => {
    throw new Error("Select a workflow step when adding an external approver.");
  },

  createExternalApproverForStep: async (workflowStepId: string, name: string, email: string) => {
    const dto = await api.post<ApiExternalApproverSessionDto>("/api/external-approvers", {
      workflowStepId,
      approverName: name,
      approverEmail: email,
    });

    const row: ExternalApprover = {
      id: dto.id,
      name,
      email,
      linkSentAt: new Date().toISOString(),
      linkExpiresAt: dto.linkExpiresAtUtc,
      otpStatus: "pending",
      actionTaken: "pending",
    };
    return row;
  },

  resendLink: async (id: string) => {
    await api.post(`/api/external-approvers/${id}/resend`);
  },

  listDelegations: async (): Promise<Delegation[]> => {
    const rows = await api.get<ApiDelegationDto[]>("/api/delegations");
    return rows.map(mapDelegation);
  },

  activeDelegationFrom: (userId: string, list: Delegation[]): Delegation | undefined =>
    list.find((d) => d.fromUserId === userId && d.active),

  activeDelegationTo: (userId: string, list: Delegation[]): Delegation | undefined =>
    list.find((d) => d.toUserId === userId && d.active),

  upsertDelegation: async (_fromUserId: string, toUserId: string, startAt: string, endAt: string, active: boolean, autoReplyMessage?: string) => {
    const dto = await api.post<ApiDelegationDto>("/api/delegations", {
      delegateUserId: toUserId,
      startsAtUtc: startAt,
      endsAtUtc: endAt,
      reason: null,
      autoReplyMessage: autoReplyMessage ?? null,
      isActive: active,
    });
    return mapDelegation(dto);
  },

  setDelegationActiveStatus: async (delegationId: string, isActive: boolean) => {
    const dto = await api.put<ApiDelegationDto>(`/api/delegations/${delegationId}/status`, { isActive });
    return mapDelegation(dto);
  },

  deactivateDelegation: async (delegationId: string) => {
    await api.delete(`/api/delegations/${delegationId}`);
  },

  cloneMatrixFromWorkflow: async (targetId: string, sourceId: string) =>
    api.post(`/api/workflows/${targetId}/clone-matrix-from/${sourceId}`),

  getUserPreferences: async () =>
    api.get<{ notificationPreferencesJson: string | null; outOfOfficeMessage: string | null; preferredLanguage: string }>("/api/users/me/preferences"),

  saveUserPreferences: async (prefs: {
    notificationPreferences?: string;
    outOfOfficeMessage?: string;
    preferredLanguage?: string;
  }) => api.put("/api/users/me/preferences", prefs),

  forceReassign: async (docId: string, newApproverId: string, reason: string, _actorId: string) => {
    const { wdas } = await import("@/services/wdas");
    const doc = await wdas.getDocument(docId);
    if (!doc.currentStepId) throw new Error("No active step to reassign.");

    await api.post(`/api/workflow-steps/${doc.currentStepId}/reassign`, {
      newApproverUserId: newApproverId,
      reason,
    });

    return { docId, newApproverId, reason, at: new Date().toISOString() };
  },
};
