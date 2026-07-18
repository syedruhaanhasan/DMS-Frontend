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
import { mapUser, mapWorkflow } from "@/lib/api/mappers";
import type {
  ApprovalMode,
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

export interface ActiveDirectorySettings {
  enabled: boolean;
  domainName: string;
  port: number;
  useSsl: boolean;
  updatedAtUtc: string | null;
}

export interface ActiveDirectoryStatus {
  enabled: boolean;
}

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

function toApiApprovalMode(mode?: ApprovalMode | "group"): ApiApprovalMode {
  switch (normalizeApprovalMode(mode)) {
    case "matrix":
      return "Matrix";
    case "user":
      return "Group";
    case "adhoc":
      return "AdHoc";
    case "hybrid":
      return "Hybrid";
  }
}

function buildGroupsPayload(w: Workflow) {
  const mode = normalizeApprovalMode(w.mode);
  const payloads: {
    name: string;
    sequenceOrder: number;
    requirement: "AnyOneMember" | "AllMembers";
    memberUserIds: string[];
  }[] = [];
  let seq = 0;

  if ((mode === "matrix" || mode === "hybrid") && w.groups?.length) {
    for (const g of w.groups) {
      payloads.push({
        name: g.name,
        sequenceOrder: ++seq,
        requirement: g.rule === "any" ? "AnyOneMember" : "AllMembers",
        memberUserIds: g.memberIds,
      });
    }
  }

  const userIds = w.approverUserIds ?? [];
  if ((mode === "user" || mode === "hybrid") && userIds.length > 0) {
    const isParallel = w.approvalSequence === "parallel";
    if (isParallel) {
      payloads.push({
        name: "Approvers",
        sequenceOrder: ++seq,
        requirement: "AnyOneMember",
        memberUserIds: userIds,
      });
    } else {
      for (const userId of userIds) {
        payloads.push({
          name: `Approver ${seq + 1}`,
          sequenceOrder: ++seq,
          requirement: "AllMembers",
          memberUserIds: [userId],
        });
      }
    }
  }

  return payloads.length > 0 ? payloads : undefined;
}

function buildMatrixPayload(w: Workflow) {
  const mode = normalizeApprovalMode(w.mode);
  if (!w.matrixBands?.length || !(mode === "matrix" || mode === "hybrid")) {
    return undefined;
  }

  const groupsById = new Map((w.groups ?? []).map((g) => [g.id, g]));
  return w.matrixBands.map((b, i) => {
    const fromUsers = b.approverUserIds ?? [];
    const fromGroups = b.approverGroupIds.flatMap((gid) => groupsById.get(gid)?.memberIds ?? []);
    const seen = new Set<string>();
    const approverUserIds = [...fromUsers, ...fromGroups].filter((id) => {
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    return {
      sequenceOrder: i + 1,
      minAmount: b.min,
      maxAmount: b.max,
      approverUserIds,
    };
  });
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

  updateUserRoles: async (userId: string, roleIds: string[]) => {
    const dto = await api.put<ApiUserSummaryDto>(`/api/users/${userId}/role`, {
      roleIds,
    });
    return mapUser(dto);
  },

  updateUser: async (
    userId: string,
    input: {
      username: string;
      displayName: string;
      email: string;
      phone?: string | null;
      title: string;
      departmentId: string;
      roleIds: string[];
      isActive?: boolean;
    },
  ) => {
    const dto = await api.put<ApiUserSummaryDto>(`/api/users/${userId}`, {
      userPrincipalName: input.username,
      displayName: input.displayName,
      email: input.email,
      phoneNumber: input.phone?.trim() || null,
      title: input.title,
      departmentId: input.departmentId,
      roleIds: input.roleIds,
      isActive: input.isActive,
    });
    return mapUser(dto);
  },

  listRoles: async () => api.get<import("@/lib/api/types").ApiSecurityRoleSummaryDto[]>("/api/roles"),

  getRole: async (id: string) => api.get<import("@/lib/api/types").ApiSecurityRoleDetailDto>(`/api/roles/${id}`),

  createRole: async (input: { name: string; code?: string | null; description?: string | null; permissions: string[] }) =>
    api.post<import("@/lib/api/types").ApiSecurityRoleDetailDto>("/api/roles", input),

  updateRole: async (
    id: string,
    input: { name: string; description?: string | null; isActive: boolean; permissions: string[] },
  ) => api.put<import("@/lib/api/types").ApiSecurityRoleDetailDto>(`/api/roles/${id}`, input),

  deleteRole: async (id: string) => {
    await api.delete(`/api/roles/${id}`);
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
    roleIds: string[];
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
      roleIds: input.roleIds,
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
      api.get<ApiApproverGroupDto[]>(`/api/workflows/${id}/approver-groups`),
      api.get<ApiMatrixTierDto[]>(`/api/workflows/${id}/matrix-tiers`).catch(() => [] as ApiMatrixTierDto[]),
    ]);
    const w = rows.find((x) => x.id === id);
    if (!w) throw new Error("Workflow not found");
    const deptName = departments.find((d) => d.id === w.departmentId)?.name;
    const sortedGroups = [...groups].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
    const mappedGroups = sortedGroups.map((g) => ({
      id: g.id,
      name: g.name,
      memberIds: g.memberUserIds ?? [],
      rule: (g.requirement === "AnyOneMember" ? "any" : "all") as import("@/lib/wdas/types").ApproverGroup["rule"],
    }));
    const mapped = mapWorkflow(w, deptName);
    const memberIds = mappedGroups.flatMap((g) => g.memberIds);

    // User-based workflows store fixed approvers as groups (API ApprovalMode.Group).
    // Older saves may have stored them under AdHoc — treat those as user mode so the UI shows selections.
    let mode = mapped.mode;
    if (memberIds.length > 0 && (mode === "adhoc" || mode === "user")) {
      mode = "user";
    }

    const approverUserIds =
      mode === "user" || mode === "hybrid"
        ? memberIds
        : undefined;

    return {
      ...mapped,
      mode,
      approverUserIds,
      groups: mappedGroups,
      matrixBands: tiers.map((t) => ({
        id: t.id,
        min: Number(t.minAmount),
        max: t.maxAmount != null ? Number(t.maxAmount) : null,
        approverUserIds: [...(t.approverUserIds ?? [])],
        approverGroupIds: mappedGroups
          .filter((g) => g.memberIds.some((uid) => (t.approverUserIds ?? []).includes(uid)))
          .map((g) => g.id),
        sequence: "sequential" as const,
      })),
    };
  },

  createWorkflow: async (w: Workflow, options?: { publishImmediately?: boolean }) => {
    const departmentId = await resolveDepartmentId(w.department);
    const name = w.name.trim();
    const documentType = (w.documentType ?? w.name.replace(/\s+/g, "")).trim();

    const mode = normalizeApprovalMode(w.mode);

    const sequenceMap = { sequential: "Sequential", parallel: "Parallel" } as const;

    const dto = await api.post<ApiWorkflowDto>("/api/workflows", {
      departmentId,
      name,
      documentType,
      description: w.description?.trim() || null,
      approvalMode: toApiApprovalMode(mode),
      approvalSequence: sequenceMap[w.approvalSequence ?? "sequential"],
      returnResumePolicy: "RestartFromFirst",
      slaThresholdHours: w.sla?.slaMandatory || w.sla?.escalationMandatory
        ? (w.sla.escalationMandatory ? w.sla.escalationHours : w.sla.reminderHours)
        : null,
      escalationEnabled: !!w.sla?.escalationMandatory,
      notificationSettingsJson: w.notifications || w.sla
        ? JSON.stringify({ ...(w.notifications ?? {}), sla: w.sla ?? null })
        : null,
      groups: buildGroupsPayload(w) ?? null,
      matrixTiers: buildMatrixPayload(w) ?? null,
      publishImmediately: options?.publishImmediately === true,
    });

    return mapWorkflow(dto);
  },

  applyWorkflowConfiguration: async (workflowId: string, w: Workflow) => {
    const mode = normalizeApprovalMode(w.mode);
    const groups = buildGroupsPayload(w) ?? [];

    if (mode === "user" || mode === "hybrid" || mode === "matrix") {
      await api.post<ApiApproverGroupDto[]>(`/api/workflows/${workflowId}/approver-groups`, { groups });
    }

    const tiers = buildMatrixPayload(w);
    if ((mode === "matrix" || mode === "hybrid") && tiers && tiers.length > 0) {
      await api.post<ApiMatrixTierDto[]>(`/api/workflows/${workflowId}/matrix-tiers`, { tiers });
    }
  },

  findWorkflowDuplicate,

  /** Create workflow. Checkers can pass publishImmediately; makers submit as Pending. */
  createAndPublishWorkflow: async (w: Workflow, options?: { publishImmediately?: boolean }) => {
    const workflows = await wdasConfig.listWorkflows("all");
    const existing = findWorkflowDuplicate(workflows, {
      name: w.name,
      documentType: w.documentType ?? "",
      department: w.department,
    });

    if (existing) {
      if (options?.publishImmediately) {
        await wdasConfig.publishWorkflowVersion(existing.id, w, "system");
      } else {
        await wdasConfig.applyWorkflowConfiguration(existing.id, w);
      }
      return wdasConfig.getWorkflow(existing.id);
    }

    const created = await wdasConfig.createWorkflow(w, options);
    // Groups/matrix already included on create when provided; keep apply for duplicates/edge cases.
    if (!(w.approverUserIds?.length || w.groups?.length || w.matrixBands?.length)) {
      await wdasConfig.applyWorkflowConfiguration(created.id, w);
    }
    return wdasConfig.getWorkflow(created.id);
  },

  /** Checker approves a pending (Draft) workflow and makes it Active. */
  approveWorkflow: async (id: string) => {
    const current = await wdasConfig.getWorkflow(id);
    return wdasConfig.publishWorkflowVersion(id, current, "checker");
  },

  publishWorkflowVersion: async (id: string, changes: Partial<Workflow>, _publishedBy: string, _note?: string) => {
    const current = await wdasConfig.getWorkflow(id);
    const merged: Workflow = {
      ...current,
      ...changes,
      approverUserIds: changes.approverUserIds ?? current.approverUserIds ?? [],
      groups: changes.groups ?? current.groups ?? [],
      matrixBands: changes.matrixBands ?? current.matrixBands ?? [],
      approvalSequence: changes.approvalSequence ?? current.approvalSequence,
      mode: changes.mode ?? current.mode,
    };

    const mergedMode = normalizeApprovalMode(merged.mode);
    const sequenceMap = { sequential: "Sequential", parallel: "Parallel" } as const;
    const groups = buildGroupsPayload(merged) ?? [];
    const matrixTiers = buildMatrixPayload(merged);

    // Single atomic publish: mode + approvers land on the new Active version together.
    await api.put<ApiWorkflowDto>(`/api/workflows/${id}`, {
      name: merged.name,
      description: merged.description || null,
      approvalMode: toApiApprovalMode(mergedMode),
      approvalSequence: sequenceMap[merged.approvalSequence ?? "sequential"],
      returnResumePolicy: merged.returnResumePolicy ?? "RestartFromFirst",
      slaThresholdHours: merged.sla?.slaMandatory || merged.sla?.escalationMandatory
        ? (merged.sla.escalationMandatory ? merged.sla.escalationHours : merged.sla.reminderHours)
        : null,
      escalationEnabled: !!merged.sla?.escalationMandatory,
      targetState: "Active",
      notificationSettingsJson: merged.notifications || merged.sla
        ? JSON.stringify({ ...(merged.notifications ?? {}), sla: merged.sla ?? null })
        : null,
      groups,
      matrixTiers: matrixTiers ?? null,
    });

    return wdasConfig.getWorkflow(id);
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

  getActiveDirectorySettings: async (): Promise<ActiveDirectorySettings> =>
    api.get<ActiveDirectorySettings>("/api/config/active-directory"),

  getActiveDirectoryStatus: async (): Promise<ActiveDirectoryStatus> =>
    api.get<ActiveDirectoryStatus>("/api/config/active-directory/status"),

  updateActiveDirectorySettings: async (input: {
    enabled: boolean;
    domainName?: string;
    port?: number;
    useSsl?: boolean;
  }): Promise<ActiveDirectorySettings> =>
    api.put<ActiveDirectorySettings>("/api/config/active-directory", {
      enabled: input.enabled,
      domainName: input.domainName ?? null,
      port: input.port ?? null,
      useSsl: input.useSsl ?? null,
    }),

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
