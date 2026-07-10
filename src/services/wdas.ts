import { api, apiPath, apiUpload } from "@/lib/api/client";
import type { ApiAttachmentDto, ApiPersonalDashboardDto, ApiRepositoryDocumentDto, ApiSearchResultDto } from "@/lib/api/types";
import {
  mapAttachment,
  mapDashboardItem,
  mapDocument,
  mapSearchItem,
  mapWorkflow,
  toApiDocStatus,
  toApiPriority,
} from "@/lib/api/mappers";
import type { Document, DocStatus, Priority, Workflow } from "@/lib/wdas/types";
import type { User } from "@/lib/wdas/types";

function buildSearchParams(filter?: {
  ownerId?: string;
  approverId?: string;
  status?: DocStatus[];
  query?: string;
}): string {
  const params = new URLSearchParams();
  params.set("Take", "100");

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

  getDocument: async (id: string): Promise<Document> => {
    const [dto, attachments] = await Promise.all([
      api.get<import("@/lib/api/types").ApiDocumentDto>(`/api/documents/${id}`),
      api.get<ApiAttachmentDto[]>(`/api/documents/${id}/attachments`).catch(() => [] as ApiAttachmentDto[]),
    ]);
    return mapDocument(dto, attachments.map(mapAttachment));
  },

  createDocument: async (
    input: Omit<Document, "id" | "createdAt" | "daysPending" | "sla" | "steps" | "status"> & { toNames?: string[] },
    submit: boolean,
    pendingFiles: File[] = [],
  ): Promise<Document> => {
    const users = await wdas.users();
    const toNames = input.toNames ?? input.toIds.map((id) => users.find((u) => u.id === id)?.name).filter(Boolean) as string[];

    const dto = await api.post<import("@/lib/api/types").ApiDocumentDto>("/api/documents", {
      workflowId: input.workflowId,
      toRecipients: toNames.join(", "),
      subject: input.subject,
      bodyHtml: input.body,
      amount: input.amount ?? null,
      priority: toApiPriority(input.priority as Priority),
      recipients: toNames.map((name) => {
        const u = users.find((x) => x.name === name);
        return { recipientName: name, recipientEmail: u?.email ?? null };
      }),
      adHocApproverUserIds: input.toIds,
      submit,
      idempotencyKey: null,
    });

    const doc = mapDocument(dto);

    for (const file of pendingFiles) {
      const form = new FormData();
      form.append("file", file);
      await apiUpload<ApiAttachmentDto>(`/api/documents/${doc.id}/attachments`, form);
    }

    if (pendingFiles.length > 0) {
      return wdas.getDocument(doc.id);
    }

    return doc;
  },

  uploadAttachment: async (documentId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return mapAttachment(await apiUpload<ApiAttachmentDto>(`/api/documents/${documentId}/attachments`, form));
  },

  previewAttachmentUrl: (attachmentId: string) => apiPath(`/api/attachments/${attachmentId}/preview`),

  actOnDocument: async (
    id: string,
    action: "approve" | "reject" | "return",
    comment: string,
    _actorId?: string,
  ): Promise<Document> => {
    const doc = await wdas.getDocument(id);
    const stepId = doc.currentStepId;
    if (!stepId) throw new Error("No active approval step on this document.");

    const path = `/api/workflow-steps/${stepId}/${action}`;
    const dto = await api.post<import("@/lib/api/types").ApiDocumentDto>(path, { comment: comment || null });
    return mapDocument(dto);
  },

  commentOnDocument: async (id: string, comment: string): Promise<Document> => {
    const doc = await wdas.getDocument(id);
    const stepId = doc.currentStepId;
    if (!stepId) throw new Error("No active approval step on this document.");
    const dto = await api.post<import("@/lib/api/types").ApiDocumentDto>(
      `/api/workflow-steps/${stepId}/comment`,
      { comment: comment || null },
    );
    return mapDocument(dto);
  },

  finalizeDocument: async (id: string, comment?: string): Promise<ApiRepositoryDocumentDto> => {
    return api.post<ApiRepositoryDocumentDto>(`/api/documents/${id}/finalize`, { comment: comment ?? null });
  },

  downloadArchive: async (archiveId: string, format: "pdf" | "html" = "pdf") => {
    const token = (await import("@/lib/api/client")).getToken();
    const res = await fetch((await import("@/lib/api/client")).apiPath(`/api/repository/${archiveId}/download?format=${format}`), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("Could not download archive");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${archiveId}.${format === "pdf" ? "pdf" : "html"}`;
    a.click();
    URL.revokeObjectURL(url);
  },

  cancelDocument: async (id: string, reason: string, _actorId?: string): Promise<Document> => {
    const dto = await api.post<import("@/lib/api/types").ApiDocumentDto>(`/api/documents/${id}/cancel`, {
      reason: reason || null,
    });
    return mapDocument(dto);
  },

  deleteDocument: async (id: string): Promise<void> => {
    await api.delete(`/api/documents/${id}`);
  },
};
