import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { wdas } from "@/services/wdas";
import { wdasConfig } from "@/services/wdas-config";
import { apiPath, getToken, ApiError } from "@/lib/api/client";
import { useSession } from "@/lib/wdas/role-context";
import { useDocumentQuery, useCanFetchDocuments } from "@/lib/wdas/use-document-query";
import { useUserById } from "@/lib/wdas/users-context";
import { StatusBadge, SlaBadge, PriorityBadge } from "@/components/wdas/badges";
import { ApprovalTrail } from "@/components/wdas/approval-trail";
import { AttachmentList } from "@/components/wdas/attachments";
import { LoadingState, ErrorState } from "@/components/wdas/data-states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/wdas/confirm-dialog";
import { formatPKR, absTime } from "@/lib/wdas/format";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Lock, Download, XCircle, Hash, Trash2 } from "lucide-react";

export const Route = createFileRoute("/documents/$id")({
  component: DetailPage,
});

function DetailPage() {
  const { id } = Route.useParams();
  const { user } = useSession();
  const qc = useQueryClient();
  const router = useRouter();

  const canFetch = useCanFetchDocuments();
  const q = useDocumentQuery(id);
  const workflowsQ = useQuery({
    queryKey: ["workflows"],
    queryFn: () => wdasConfig.listWorkflows("all"),
    enabled: canFetch,
  });
  const owner = useUserById(q.data?.ownerId);
  const [cancel, setCancel] = useState(false);
  const [finalize, setFinalize] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (!canFetch || q.isPending) return <LoadingState />;
  if (q.isError || !q.data) {
    const message = q.error instanceof ApiError ? q.error.message : "Document not available.";
    return <ErrorState message={message} onRetry={() => q.refetch()} />;
  }

  const doc = q.data;
  const workflow = workflowsQ.data?.find((w) => w.id === doc.workflowId);
  const finalized = ["approved", "rejected", "cancelled"].includes(doc.status);
  const canCancel = doc.ownerId === user.id && (doc.status === "pending" || doc.status === "returned" || doc.status === "draft" || doc.status === "ready_to_finalize");
  const canFinalize = doc.ownerId === user.id && doc.status === "ready_to_finalize";
  const canDelete = doc.ownerId === user.id && (doc.status === "draft" || doc.status === "cancelled");

  const runFinalize = async (comment?: string) => {
    try {
      const repo = await wdas.finalizeDocument(doc.id, comment);
      toast.success("Document finalized", { description: `Archive ID: ${repo.archiveDocumentId}` });
      qc.invalidateQueries();
      q.refetch();
    } catch (e) { toast.error((e as Error).message); }
  };

  const downloadArchive = async (format: "pdf" | "html") => {
    if (!doc.archiveDocumentId) return;
    try {
      await wdas.downloadArchive(doc.archiveDocumentId, format);
      toast.success(format === "pdf" ? "PDF archive downloaded" : "HTML archive downloaded");
    } catch (e) { toast.error((e as Error).message); }
  };

  const previewAttachment = async (attachmentId: string) => {
    try {
      const token = getToken();
      const res = await fetch(apiPath(`/api/attachments/${attachmentId}/preview`), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Could not open preview");
      const blob = await res.blob();
      window.open(URL.createObjectURL(blob), "_blank");
    } catch (e) { toast.error((e as Error).message); }
  };

  const exportAuditTrail = () => {
    const payload = {
      documentId: doc.id,
      archiveId: doc.archiveDocumentId ?? doc.refId,
      subject: doc.subject,
      status: doc.status,
      steps: doc.steps,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-${doc.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const runCancel = async (reason?: string) => {
    try {
      await wdas.cancelDocument(doc.id, reason ?? "", user.id);
      toast.success("Document cancelled");
      qc.invalidateQueries();
      router.navigate({ to: "/documents" });
    } catch (e) { toast.error((e as Error).message); }
  };

  const runDelete = async () => {
    try {
      await wdas.deleteDocument(doc.id);
      toast.success("Document deleted");
      qc.invalidateQueries();
      router.navigate({ to: "/documents" });
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div>
      <div className="sticky top-0 z-20 border-b bg-card/95 px-6 py-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mb-3">
          <Button asChild variant="ghost" size="sm" className="-ml-2 h-7 gap-1">
            <Link to="/documents"><ArrowLeft className="h-4 w-4" /> Back</Link>
          </Button>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">{doc.subject}</h1>
              {finalized && <Lock className="h-4 w-4 text-muted-foreground" aria-label="Locked" />}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {owner?.name} · {owner?.department} · Created {absTime(doc.createdAt)}
            </p>
            {doc.refId && (
              <p className="mt-1 flex items-center gap-1 text-sm font-mono text-primary">
                <Hash className="h-3.5 w-3.5" /> {doc.refId}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PriorityBadge priority={doc.priority} />
            <StatusBadge status={doc.status} />
            <SlaBadge sla={doc.sla} />
          </div>
        </div>
      </div>

      {finalized && (
        <div className="mx-6 mt-6 flex items-center gap-3 rounded-md border border-info/30 bg-info/10 px-4 py-3 text-sm">
          <Lock className="h-4 w-4 text-info" />
          <span className="flex-1">This document is finalized and locked. Contents are read-only and immutable.</span>
          {doc.archiveDocumentId && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => downloadArchive("pdf")}><Download className="mr-1.5 h-3.5 w-3.5" /> PDF</Button>
              <Button size="sm" variant="ghost" onClick={() => downloadArchive("html")}>HTML</Button>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-6 p-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle className="text-sm">Document body</CardTitle></CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none rounded-md border bg-muted/30 p-4" dangerouslySetInnerHTML={{ __html: doc.body }} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Attachments</CardTitle></CardHeader>
            <CardContent><AttachmentList attachments={doc.attachments} onPreview={(a) => previewAttachment(a.id)} /></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Approval trail</CardTitle>
              <Button variant="outline" size="sm" onClick={exportAuditTrail}>Export JSON</Button>
            </CardHeader>
            <CardContent><ApprovalTrail steps={doc.steps} currentStepId={doc.currentStepId} /></CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Details</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Workflow" value={workflow?.name} />
              <Row label="Type" value={workflow?.type === "financial" ? "Financial" : "Non-financial"} />
              {doc.amount != null && <Row label="Amount" value={formatPKR(doc.amount)} mono />}
              <Row label="Priority" value={doc.priority} />
              <Row label="Owner" value={owner?.name} />
              <Row label="Department" value={owner?.department} />
              {doc.submittedAt && <Row label="Submitted" value={absTime(doc.submittedAt)} />}
              {doc.finalizedAt && <Row label="Finalized" value={absTime(doc.finalizedAt)} />}
              {doc.cancelReason && <Row label="Cancel reason" value={doc.cancelReason} />}
            </CardContent>
          </Card>

          {canFinalize && (
            <Button className="w-full" onClick={() => setFinalize(true)}>
              <Hash className="mr-2 h-4 w-4" /> Finalize document
            </Button>
          )}

          {canCancel && (
            <Button variant="outline" className="w-full text-destructive hover:text-destructive" onClick={() => setCancel(true)}>
              <XCircle className="mr-2 h-4 w-4" /> Cancel document
            </Button>
          )}

          {canDelete && (
            <Button variant="outline" className="w-full text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="mr-2 h-4 w-4" /> Delete document
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={finalize}
        onOpenChange={setFinalize}
        title="Finalize this document?"
        description="This assigns a permanent archive ID and locks the document. This cannot be undone."
        confirmLabel="Finalize"
        onConfirm={runFinalize}
      />

      <ConfirmDialog
        open={cancel}
        onOpenChange={setCancel}
        title="Cancel this document?"
        description="This will withdraw the document from the workflow. This action cannot be undone."
        confirmLabel="Cancel document"
        cancelLabel="Keep it"
        variant="destructive"
        requireReason
        onConfirm={runCancel}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this document?"
        description="This permanently removes the document and its attachments. Only the document owner can do this."
        confirmLabel="Delete document"
        variant="destructive"
        onConfirm={runDelete}
      />
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value?: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono" : ""}>{value ?? "—"}</span>
    </div>
  );
}
