import { api, apiPath, apiUpload } from "@/lib/api/client";
import type { ApiAttachmentDto, ApiPersonalDashboardDto, ApiRepositoryDocumentDto, ApiSearchResultDto } from "@/lib/api/types";
import {
  mapAttachment,
  mapDashboardItem,
  mapDocument,
  applyDocumentRevision,
  mapSearchItem,
  mapWorkflow,
  toApiDocStatus,
  toApiPriority,
} from "@/lib/api/mappers";
import { attachmentSizeError } from "@/lib/wdas/attachment-limits";
import type { Document, DocStatus, Priority, Workflow } from "@/lib/wdas/types";
import type { User } from "@/lib/wdas/types";

function buildSearchParams(filter?: {
  ownerId?: string;
  approverId?: string;
  status?: DocStatus[];
  query?: string;
  repositoryOnly?: boolean;
}): string {
  const params = new URLSearchParams();
  params.set("Take", "100");

  if (filter?.repositoryOnly) params.set("RepositoryOnly", "true");
  if (filter?.query) params.set("Query", filter.query);
  if (filter?.ownerId) params.set("OwnerUserId", filter.ownerId);
  if (filter?.approverId) params.set("ApproverUserId", filter.approverId);
  if (filter?.status?.length === 1) {
    const mapped = toApiDocStatus(filter.status[0]);
    if (mapped) params.set("Status", mapped);
  }

  return params.toString();
}

async function searchDocuments(filter?: {
  ownerId?: string;
  approverId?: string;
  status?: DocStatus[];
  query?: string;
  repositoryOnly?: boolean;
}): Promise<Document[]> {
  const qs = buildSearchParams(filter);
  const result = await api.get<ApiSearchResultDto>(`/api/search?${qs}`);
  let items = result.items.map(mapSearchItem);

  if (filter?.status && filter.status.length > 1) {
    items = items.filter((d) => filter.status!.includes(d.status));
  }

  return items;
}

export const wdas = {
  users: async (): Promise<User[]> => {
    const { wdasConfig } = await import("@/services/wdas-config");
    return wdasConfig.listUsers();
  },

  workflows: async (): Promise<Workflow[]> => {
    const { wdasConfig } = await import("@/services/wdas-config");
    return wdasConfig.listWorkflows("all");
  },

  getPersonalDashboard: async (currentUserId?: string) => {
    const data = await api.get<ApiPersonalDashboardDto>("/api/dashboard/me");
    return {
      pending: data.pendingMyApproval.map((d) => mapDashboardItem(d)),
      delegated: (data.delegatedPendingApproval ?? []).map((d) => mapDashboardItem(d)),
      mine: data.myDocuments.map((d) => mapDashboardItem(d, currentUserId)),
      completed: data.recentlyCompleted.map((d) => mapDashboardItem(d)),
    };
  },

  getDepartmentDashboard: async (departmentId: string) => {
    const data = await api.get<import("@/lib/api/types").ApiDepartmentDashboardDto>(`/api/dashboard/department/${departmentId}`);
    return {
      departmentId: data.departmentId,
      departmentName: data.departmentName,
      documents: data.documents.map((d) => mapDashboardItem(d)),
    };
  },

  getSuccessMetrics: async (departmentId?: string) =>
    api.get<import("@/lib/api/types").ApiSuccessMetricsDto>(
      `/api/reports/success-metrics${departmentId ? `?departmentId=${departmentId}` : ""}`,
    ),

  listDocuments: async (filter?: {
    ownerId?: string;
    approverId?: string;
    status?: DocStatus[];
    query?: string;
  }): Promise<Document[]> => {
    if (filter?.approverId && !filter.ownerId && !filter.status?.length && !filter.query) {
      const dash = await wdas.getPersonalDashboard();
      return dash.pending;
    }

    if (filter?.ownerId && !filter.approverId && !filter.status?.length && !filter.query) {
      const dash = await wdas.getPersonalDashboard(filter.ownerId);
      return dash.mine;
    }

    if (filter?.status?.length && filter.status.every((s) => ["approved", "rejected", "cancelled"].includes(s)) && !filter.ownerId && !filter.approverId) {
      const dash = await wdas.getPersonalDashboard();
      return dash.completed;
    }

    return searchDocuments(filter);
  },

  listRepositoryDocuments: async (): Promise<Document[]> => {
    const result = await api.get<ApiSearchResultDto>("/api/repository/documents?Take=200");
    return result.items.map(mapSearchItem);
  },

  /** Documents where the current user is an informational reviewer (added by creator or an approver). */
  listReviewDocuments: async (): Promise<Document[]> => {
    const data = await api.get<import("@/lib/api/types").ApiDashboardDocumentItemDto[]>(
      "/api/dashboard/for-review",
    );
    return data.map((d) => mapDashboardItem(d));
  },

  getDocument: async (id: string): Promise<Document> => {
    const [dto, attachments] = await Promise.all([
      api.get<import("@/lib/api/types").ApiDocumentDto>(`/api/documents/${id}`),
      api.get<ApiAttachmentDto[]>(`/api/documents/${id}/attachments`).catch(() => [] as ApiAttachmentDto[]),
    ]);
    return mapDocument(dto, attachments.map(mapAttachment));
  },

  listDocumentRevisions: async (id: string) => {
    return api.get<import("@/lib/api/types").ApiDocumentRevisionSummaryDto[]>(
      `/api/documents/${id}/revisions`,
    );
  },

  getDocumentRevision: async (id: string, revisionNumber: number) => {
    const dto = await api.get<import("@/lib/api/types").ApiDocumentRevisionDetailDto>(
      `/api/documents/${id}/revisions/${revisionNumber}`,
    );
    return dto;
  },

  /** Live document with a historical revision's content/workflow overlaid. */
  getDocumentAtRevision: async (id: string, revisionNumber: number): Promise<Document> => {
    const [doc, rev] = await Promise.all([
      wdas.getDocument(id),
      wdas.getDocumentRevision(id, revisionNumber),
    ]);
    return applyDocumentRevision(doc, rev);
  },

  createDocument: async (
    input: Omit<Document, "id" | "createdAt" | "daysPending" | "sla" | "steps" | "status"> & {
      toNames?: string[];
      /** Reviewers receive the document to review but do not approve/reject. */
      reviewerIds?: string[];
      reviewerNames?: string[];
      /** Prefer passing the already-loaded directory users to avoid an extra full-list API call. */
      directoryUsers?: User[];
    },
    submit: boolean,
    pendingFiles: File[] = [],
  ): Promise<Document> => {
    const users = input.directoryUsers?.length ? input.directoryUsers : await wdas.users();
    // Recipients on the document represent reviewers (informational — no approval authority).
    const reviewerIds = input.reviewerIds ?? [];
    const reviewerNames =
      input.reviewerNames ??
      (reviewerIds.map((id) => users.find((u) => u.id === id)?.name).filter(Boolean) as string[]);
    // Prefer building recipients from reviewer user ids so the backend can link them to a
    // known user (view access, notifications, and the "For Review" list all depend on this).
    const recipients = reviewerIds.length
      ? reviewerIds.map((id) => {
          const u = users.find((x) => x.id === id);
          return { recipientName: u?.name ?? id, recipientEmail: u?.email ?? null, reviewerUserId: String(id) };
        })
      : reviewerNames.map((name) => {
          const u = users.find((x) => x.name === name);
          return { recipientName: name, recipientEmail: u?.email ?? null, reviewerUserId: u?.id ?? null };
        });
    const priority = toApiPriority(input.priority as Priority);
    // Attachments are only allowed on drafts — create first, upload, then submit.
    const shouldDeferSubmit = submit && pendingFiles.length > 0;

    const dto = await api.post<import("@/lib/api/types").ApiDocumentDto>("/api/documents", {
      workflowId: input.workflowId,
      toRecipients: reviewerNames.join(", "),
      subject: input.subject,
      bodyHtml: input.body,
      amount: input.amount ?? null,
      priority,
      recipients,
      adHocApproverUserIds: input.toIds,
      downloadAllowedUserIds: input.downloadAllowedUserIds ?? [],
      submit: shouldDeferSubmit ? false : submit,
      idempotencyKey: null,
    });

    await Promise.all(
      pendingFiles.map(async (file) => {
        const sizeError = attachmentSizeError(file);
        if (sizeError) throw new Error(sizeError);
        const form = new FormData();
        form.append("file", file);
        await apiUpload<ApiAttachmentDto>(`/api/documents/${dto.id}/attachments`, form);
      }),
    );

    if (shouldDeferSubmit) {
      const submitted = await api.post<import("@/lib/api/types").ApiDocumentDto>(`/api/documents/${dto.id}/submit`, {
        idempotencyKey: null,
      });
      return mapDocument(submitted);
    }

    if (pendingFiles.length > 0) {
      return wdas.getDocument(dto.id);
    }

    return mapDocument(dto);
  },

  uploadAttachment: async (documentId: string, file: File) => {
    const sizeError = attachmentSizeError(file);
    if (sizeError) throw new Error(sizeError);
    const form = new FormData();
    form.append("file", file);
    return mapAttachment(await apiUpload<ApiAttachmentDto>(`/api/documents/${documentId}/attachments`, form));
  },

  previewAttachmentUrl: (attachmentId: string) => apiPath(`/api/attachments/${attachmentId}/preview`),

  actOnDocument: async (
    id: string,
    action: "approve" | "reject" | "return",
    comment: string,
    actorId?: string,
    preferredStepId?: string,
    selectedText?: string,
  ): Promise<Document> => {
    const doc = await wdas.getDocument(id);
    // Prefer the caller's own active step (parallel / multi-approver), then inbox step id, then first active.
    const actorStepId = actorId
      ? doc.steps.find((s) => s.status === "pending" && s.approverId === actorId)?.id
      : undefined;
    const preferredOk = preferredStepId && doc.steps.some((s) => s.id === preferredStepId && s.status === "pending")
      ? preferredStepId
      : undefined;
    const stepId = actorStepId ?? preferredOk ?? doc.currentStepId;
    if (!stepId) throw new Error("No active approval step on this document.");

    const path = `/api/workflow-steps/${stepId}/${action}`;
    const dto = await api.post<import("@/lib/api/types").ApiDocumentDto>(path, {
      comment: comment || null,
      selectedText: selectedText || null,
    });
    return mapDocument(dto);
  },

  /** Current approver adds one informational reviewer (they receive/view the doc, no approval authority). */
  addReviewer: async (id: string, reviewerUserId: string): Promise<Document> => {
    const dto = await api.post<import("@/lib/api/types").ApiDocumentDto>(
      `/api/documents/${id}/reviewers`,
      { reviewerUserId },
    );
    return mapDocument(dto);
  },

  /** Reviewer completes creator-gated review; document returns to owner when all reviewers finish. */
  completeReviewerReview: async (id: string, comment?: string, selectedText?: string): Promise<Document> => {
    const dto = await api.post<import("@/lib/api/types").ApiDocumentDto>(
      `/api/documents/${id}/complete-review`,
      { comment: comment ?? null, selectedText: selectedText || null },
    );
    return mapDocument(dto);
  },

  /** Owner sends document to approver after reviewer(s) have completed review. */
  sendForApproval: async (id: string): Promise<Document> => {
    const dto = await api.post<import("@/lib/api/types").ApiDocumentDto>(`/api/documents/${id}/submit`, {
      idempotencyKey: null,
    });
    return mapDocument(dto);
  },

  commentOnDocument: async (id: string, comment: string, selectedText?: string): Promise<Document> => {
    const doc = await wdas.getDocument(id);
    const stepId = doc.currentStepId;
    if (!stepId) throw new Error("No active approval step on this document.");
    const dto = await api.post<import("@/lib/api/types").ApiDocumentDto>(
      `/api/workflow-steps/${stepId}/comment`,
      { comment: comment || null, selectedText: selectedText || null },
    );
    return mapDocument(dto);
  },

  finalizeDocument: async (id: string, comment?: string): Promise<ApiRepositoryDocumentDto> => {
    return api.post<ApiRepositoryDocumentDto>(`/api/documents/${id}/finalize`, { comment: comment ?? null });
  },

  downloadArchive: async (archiveId: string, format: "pdf" | "html" = "pdf", fileName?: string) => {
    const token = (await import("@/lib/api/client")).getToken();
    const res = await fetch((await import("@/lib/api/client")).apiPath(`/api/repository/${archiveId}/download?format=${format}`), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("Could not download archive");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName = (fileName ?? archiveId)
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 80) || archiveId;
    a.download = `${safeName}.${format === "pdf" ? "pdf" : "html"}`;
    a.click();
    URL.revokeObjectURL(url);
  },

  cancelDocument: async (id: string, reason: string, _actorId?: string): Promise<Document> => {
    const dto = await api.post<import("@/lib/api/types").ApiDocumentDto>(`/api/documents/${id}/cancel`, {
      reason: reason || null,
    });
    return mapDocument(dto);
  },

  /** Reopen a rejected document for the owner; bumps revision (v2, v3, …). */
  reviseDocument: async (id: string): Promise<Document> => {
    const dto = await api.post<import("@/lib/api/types").ApiDocumentDto>(`/api/documents/${id}/revise`);
    return mapDocument(dto);
  },

  updateDocument: async (
    id: string,
    input: {
      subject: string;
      body: string;
      toIds: string[];
      amount?: number;
      priority: Priority;
      toNames?: string[];
      directoryUsers?: User[];
      downloadAllowedUserIds?: string[];
      reviewerIds?: string[];
    },
    submit: boolean,
    pendingFiles: File[] = [],
  ): Promise<Document> => {
    const priority = toApiPriority(input.priority as Priority);
    const shouldDeferSubmit = submit && pendingFiles.length > 0;

    // Always leave recipients/approvers untouched on the server for update/resubmit.
    // Rewriting DocumentRecipient rows caused DbUpdateConcurrencyException.
    const existing = await api.get<import("@/lib/api/types").ApiDocumentDto>(`/api/documents/${id}`);

    const dto = await api.put<import("@/lib/api/types").ApiDocumentDto>(`/api/documents/${id}`, {
      toRecipients: existing.toRecipients ?? "",
      subject: input.subject,
      bodyHtml: input.body,
      amount: input.amount ?? null,
      priority,
      recipients: null,
      adHocApproverUserIds: null,
      downloadAllowedUserIds: input.downloadAllowedUserIds ?? [],
      submit: shouldDeferSubmit ? false : submit,
      idempotencyKey: null,
    });

    await Promise.all(
      pendingFiles.map(async (file) => {
        const sizeError = attachmentSizeError(file);
        if (sizeError) throw new Error(sizeError);
        const form = new FormData();
        form.append("file", file);
        await apiUpload<ApiAttachmentDto>(`/api/documents/${id}/attachments`, form);
      }),
    );

    if (shouldDeferSubmit) {
      const submitted = await api.post<import("@/lib/api/types").ApiDocumentDto>(`/api/documents/${id}/submit`, {
        idempotencyKey: null,
      });
      return mapDocument(submitted);
    }

    if (pendingFiles.length > 0) {
      return wdas.getDocument(id);
    }

    return mapDocument(dto);
  },

  deleteDocument: async (id: string): Promise<void> => {
    await api.delete(`/api/documents/${id}`);
  },

  exportAudit: async (
    request: import("@/lib/api/types").ApiAuditExportRequest = {},
  ): Promise<import("@/lib/api/types").ApiAuditExportResult> => {
    return api.post<import("@/lib/api/types").ApiAuditExportResult>("/api/audit/export", {
      documentId: request.documentId ?? null,
      departmentId: request.departmentId ?? null,
      fromUtc: request.fromUtc ?? null,
      toUtc: request.toUtc ?? null,
    });
  },
};
