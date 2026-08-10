import { createFileRoute, useRouter, Link, Outlet, useChildMatches } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { wdas } from "@/services/wdas";
import { wdasConfig } from "@/services/wdas-config";
import { apiPath, getToken, ApiError } from "@/lib/api/client";
import { useSession } from "@/lib/wdas/role-context";
import { useDocumentQuery, useCanFetchDocuments } from "@/lib/wdas/use-document-query";
import { useUserById, useUsers } from "@/lib/wdas/users-context";
import { StatusBadge, SlaBadge, PriorityBadge } from "@/components/wdas/badges";
import { ApprovalTrail } from "@/components/wdas/approval-trail";
import { ApprovalFlowChart, buildDocumentFlowNodes } from "@/components/wdas/approval-flow-chart";
import { WorkflowStepper } from "@/components/wdas/workflow-stepper";
import { CommentThread } from "@/components/wdas/comment-thread";
import { AttachmentList } from "@/components/wdas/attachments";
import { LoadingState, ErrorState } from "@/components/wdas/data-states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/wdas/confirm-dialog";
import { formatPKR, absTime } from "@/lib/wdas/format";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Lock,
  Download,
  XCircle,
  Hash,
  Trash2,
  Pencil,
  Check,
  Loader2,
} from "lucide-react";
import { downloadHtmlAsPdf } from "@/lib/wdas/download-html-pdf";
import type { Document, Priority } from "@/lib/wdas/types";
import { applyDocumentRevision, scopeDocumentToCycle } from "@/lib/api/mappers";

export const Route = createFileRoute("/documents/$id")({
  component: DocumentIdLayout,
});

function DocumentIdLayout() {
  const childMatches = useChildMatches();
  if (childMatches.length > 0) {
    return <Outlet />;
  }
  return <DetailPage />;
}

function isBodyEmpty(html: string): boolean {
  if (!html.trim()) return true;
  const el = document.createElement("div");
  el.innerHTML = html;
  return !el.textContent?.trim();
}

function DetailPage() {
  const { id } = Route.useParams();
  const { user, role } = useSession();
  const { users } = useUsers();
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
  const [revising, setRevising] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmResubmit, setConfirmResubmit] = useState(false);
  const [confirmSendForApproval, setConfirmSendForApproval] = useState(false);
  const [sendingForApproval, setSendingForApproval] = useState(false);

  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editPriority, setEditPriority] = useState<Priority>("Normal");
  const editorRef = useRef<HTMLDivElement>(null);
  const [selectedRev, setSelectedRev] = useState<number | null>(null);

  const doc = q.data;
  const currentRev = doc?.revisionNumber && doc.revisionNumber > 0 ? doc.revisionNumber : 1;
  // Once the owner enters edit mode, keep the editor open (don't depend on status remapping).
  const showEditor = editing && !!doc;
  const activeRev = selectedRev ?? currentRev;
  const viewingHistorical = !showEditor && !!doc && activeRev !== currentRev;

  const revisionsQ = useQuery({
    queryKey: ["doc", id, "revisions"],
    queryFn: () => wdas.listDocumentRevisions(id),
    enabled: canFetch,
  });
  // Always load the selected version so sequential routing is version-scoped (not all cycles mixed).
  const revisionDetailQ = useQuery({
    queryKey: ["doc", id, "revisions", activeRev],
    queryFn: () => wdas.getDocumentRevision(id, activeRev),
    enabled: canFetch,
  });

  // Follow the live revision when the document or its version number changes.
  useEffect(() => {
    setSelectedRev(null);
  }, [doc?.id, doc?.revisionNumber]);

  // Keep editor DOM in sync when entering edit mode.
  useEffect(() => {
    if (!showEditor || !editorRef.current) return;
    editorRef.current.innerHTML = editBody || "<p><br></p>";
    // Sync once when editor opens — editBody intentionally omitted from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showEditor, doc?.id, doc?.revisionNumber]);

  // Disabled queries stay "pending" in TanStack Query — only treat as loading while we can fetch.
  if (!canFetch) return <LoadingState />;
  if (q.isLoading) return <LoadingState />;
  if (q.isError || !doc) {
    const message = q.error instanceof ApiError ? q.error.message : "Document not available.";
    return <ErrorState message={message} onRetry={() => q.refetch()} />;
  }

  const viewDoc = (() => {
    if (revisionDetailQ.data) {
      return applyDocumentRevision(doc, revisionDetailQ.data);
    }
    const listedCycle = revisionsQ.data?.find((r) => r.revisionNumber === activeRev)?.approvalCycle;
    const fallbackCycle =
      listedCycle ??
      (activeRev === currentRev
        ? Math.max(1, ...doc.steps.map((s) => s.approvalCycle ?? 1))
        : activeRev);
    return scopeDocumentToCycle(doc, fallbackCycle);
  })();

  const workflow = workflowsQ.data?.find((w) => w.id === doc.workflowId);
  const isFinalized = doc.status === "approved";
  const isRejected = doc.status === "rejected";
  const isCancelled = doc.status === "cancelled";
  const isReturned = doc.status === "returned";
  const isDraft = doc.status === "draft";
  const isPendingReviewer = doc.status === "pending_reviewer";
  const isPendingCreatorSend = doc.status === "pending_creator_send";
  const rejectionStep = doc.steps.find((s) => s.status === "rejected");
  const canCancel =
    doc.ownerId === user.id &&
    (doc.status === "pending" || isReturned || isDraft || doc.status === "ready_to_finalize" || isPendingReviewer || isPendingCreatorSend);
  const canFinalize = doc.ownerId === user.id && doc.status === "ready_to_finalize";
  const canSendForApproval = doc.ownerId === user.id && isPendingCreatorSend;
  const canDelete = doc.ownerId === user.id && (isDraft || isCancelled);
  const canUpdate = doc.ownerId === user.id && (isRejected || isReturned || isDraft);
  const canDownloadDoc =
    String(doc.ownerId) === String(user.id) ||
    role === "super_admin" ||
    role === "auditor" ||
    (doc.downloadAllowedUserIds ?? []).map(String).includes(String(user.id));

  const completedReviewerNotes = (viewDoc.reviewers ?? []).filter(
    (reviewer) => Boolean(reviewer.reviewedAt),
  );

  const activityComments = [
    ...completedReviewerNotes.map((reviewer) => ({
      id: `reviewer-${reviewer.id}`,
      author: users.find((candidate) => candidate.id === reviewer.userId)?.name ?? reviewer.name,
      role: reviewer.addedById && reviewer.addedById !== viewDoc.ownerId
        ? `Reviewer (added by ${users.find((u) => u.id === reviewer.addedById)?.name ?? "approver"})`
        : "Reviewer",
      timestamp: reviewer.reviewedAt!,
      body: reviewer.reviewComment?.trim() || "Review completed",
      action: "review" as const,
    })),
    ...viewDoc.steps.flatMap((step) => {
      const history = step.actionHistory?.length
        ? step.actionHistory
        : step.comment && step.actedAt
          ? [{
              id: step.id,
              actorId: step.approverId,
              actorName: undefined as string | undefined,
              actionType: step.status,
              comment: step.comment,
              actedAt: step.actedAt,
            }]
          : [];

      return history
        .filter((entry) => entry.comment?.trim())
        .map((entry) => {
          const type = (entry.actionType ?? "").toLowerCase();
          const action =
            type.includes("reject") || step.status === "rejected"
              ? ("rejected" as const)
              : type.includes("return") || step.status === "returned"
                ? ("returned" as const)
                : type.includes("approve") || step.status === "approved"
                  ? ("approved" as const)
                  : ("comment" as const);
          return {
            id: entry.id,
            author:
              entry.actorName ??
              users.find((candidate) => candidate.id === entry.actorId)?.name ??
              users.find((candidate) => candidate.id === step.approverId)?.name ??
              "Approver",
            role: users.find((candidate) => candidate.id === (entry.actorId || step.approverId))?.designation,
            timestamp: entry.actedAt,
            body: entry.comment!,
            action,
            attachmentName: step.attachmentName,
          };
        });
    }),
  ];

  const beginEdit = (source: Document) => {
    setSelectedRev(null);
    setEditSubject(source.subject);
    setEditBody(source.body || "");
    setEditAmount(source.amount != null ? String(source.amount) : "");
    setEditPriority(source.priority);
    setEditing(true);
  };

  const runUpdate = async () => {
    if (revising) return;
    setRevising(true);
    try {
      if (isRejected) {
        try {
          const revised = await wdas.reviseDocument(doc.id);
          qc.setQueryData(["doc", doc.id], revised);
          void qc.invalidateQueries({ queryKey: ["doc", doc.id, "revisions"] });
          toast.success(`Opened as v${revised.revisionNumber ?? 2} — edit below, then resubmit.`);
          beginEdit(revised);
          return;
        } catch (reviseErr) {
          // Document may already have been revised in a previous attempt.
          const fresh = await wdas.getDocument(doc.id);
          qc.setQueryData(["doc", doc.id], fresh);
          if (fresh.status === "returned" || fresh.status === "draft") {
            toast.message(`Continue editing v${fresh.revisionNumber ?? 1}`);
            beginEdit(fresh);
            return;
          }
          throw reviseErr;
        }
      }
      beginEdit(doc);
      toast.message("Edit mode", {
        description: "Update the fields below, then save or resubmit.",
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRevising(false);
    }
  };

  const readBody = () => {
    const html = editorRef.current?.innerHTML ?? editBody;
    return isBodyEmpty(html) ? "" : html;
  };

  const saveDocument = async (submit: boolean) => {
    if (saving) return;
    const subject = editSubject.trim();
    const bodyHtml = readBody();
    if (!subject || isBodyEmpty(bodyHtml)) {
      toast.error("Subject and body are required.");
      return;
    }
    setSaving(true);
    try {
      const amountNum = editAmount ? Number(editAmount.replace(/,/g, "")) : undefined;
      const updated = await wdas.updateDocument(
        doc.id,
        {
          subject,
          body: bodyHtml,
          toIds: doc.toIds,
          amount: Number.isFinite(amountNum) ? amountNum : undefined,
          priority: editPriority,
          directoryUsers: users,
        },
        submit,
      );
      qc.setQueryData(["doc", doc.id], updated);
      void qc.invalidateQueries({ queryKey: ["docs"] });
      void qc.invalidateQueries({ queryKey: ["dashboard", "me"] });
      void qc.invalidateQueries({ queryKey: ["doc", doc.id, "revisions"] });
      setEditing(false);
      setConfirmResubmit(false);
      toast.success(
        submit
          ? `v${updated.revisionNumber ?? doc.revisionNumber ?? 1} submitted for approval`
          : "Changes saved",
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const runFinalize = async (comment?: string) => {
    try {
      const repo = await wdas.finalizeDocument(doc.id, comment);
      toast.success("Document finalized", { description: `Archive ID: ${repo.archiveDocumentId}` });
      qc.invalidateQueries();
      q.refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const downloadArchive = async (format: "pdf" | "html") => {
    if (!doc.archiveDocumentId) return;
    try {
      await wdas.downloadArchive(doc.archiveDocumentId, format, doc.subject.trim() || undefined);
      toast.success(format === "pdf" ? "PDF archive downloaded" : "HTML archive downloaded");
    } catch (e) {
      toast.error((e as Error).message);
    }
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
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const exportAuditTrail = () => {
    const payload = {
      documentId: doc.id,
      archiveId: doc.archiveDocumentId ?? doc.refId,
      subject: viewDoc.subject,
      revisionNumber: viewDoc.revisionNumber ?? activeRev,
      status: doc.status,
      steps: viewDoc.steps,
      reviewers: viewDoc.reviewers,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-${doc.id}-v${viewDoc.revisionNumber ?? activeRev}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const runCancel = async (reason?: string) => {
    try {
      await wdas.cancelDocument(doc.id, reason ?? "", user.id);
      toast.success("Document cancelled");
      qc.invalidateQueries();
      router.navigate({ to: "/documents" });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const runDelete = async () => {
    try {
      await wdas.deleteDocument(doc.id);
      toast.success("Document deleted");
      qc.invalidateQueries();
      router.navigate({ to: "/documents" });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const runSendForApproval = async () => {
    if (sendingForApproval) return;
    setSendingForApproval(true);
    try {
      const updated = await wdas.sendForApproval(doc.id);
      qc.setQueryData(["doc", doc.id], updated);
      void qc.invalidateQueries({ queryKey: ["docs"] });
      void qc.invalidateQueries({ queryKey: ["dashboard", "me"] });
      setConfirmSendForApproval(false);
      toast.success("Document sent for approval");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSendingForApproval(false);
    }
  };

  return (
    <div className="min-h-full bg-muted/20">
      <div className="sticky top-0 z-20 border-b bg-card/95 px-6 py-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mb-3">
          <Button asChild variant="ghost" size="sm" className="-ml-2 h-7 gap-1">
            <Link to="/documents">
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
          </Button>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {showEditor ? (
              <div className="space-y-1.5">
                <Label htmlFor="edit-subject">Subject</Label>
                <Input
                  id="edit-subject"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  className="text-lg font-semibold"
                />
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-semibold">{viewDoc.subject}</h1>
                  <Select
                    value={String(activeRev)}
                    onValueChange={(v) => {
                      const n = Number(v);
                      setSelectedRev(n === currentRev ? null : n);
                    }}
                  >
                    <SelectTrigger className="h-7 w-[7.5rem] font-mono text-xs">
                      <SelectValue placeholder="Version" />
                    </SelectTrigger>
                    <SelectContent>
                      {(revisionsQ.data?.length
                        ? revisionsQ.data
                        : [{ revisionNumber: currentRev, isCurrent: true, subject: doc.subject }]
                      ).map((rev) => (
                        <SelectItem
                          key={rev.revisionNumber}
                          value={String(rev.revisionNumber)}
                          className="font-mono text-xs"
                        >
                          v{rev.revisionNumber}
                          {rev.isCurrent || rev.revisionNumber === currentRev ? " (current)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isFinalized && (
                    <Lock className="h-4 w-4 text-muted-foreground" aria-label="Locked" />
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {owner?.name} · {owner?.department} · Created {absTime(doc.createdAt)}
                </p>
                {doc.refId && (
                  <p className="mt-1 flex items-center gap-1 text-sm font-mono text-primary">
                    <Hash className="h-3.5 w-3.5" /> {doc.refId}
                  </p>
                )}
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canUpdate && !showEditor && (
              <Button size="sm" onClick={() => void runUpdate()} disabled={revising}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                {revising ? "Opening…" : "Update"}
              </Button>
            )}
            {showEditor && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saving}
                  onClick={() => setEditing(false)}
                >
                  Cancel edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saving || !editSubject.trim()}
                  onClick={() => void saveDocument(false)}
                >
                  {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                  Save
                </Button>
                <Button
                  size="sm"
                  disabled={saving || !editSubject.trim()}
                  onClick={() => setConfirmResubmit(true)}
                >
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                  Resubmit
                </Button>
              </>
            )}
            {!showEditor && (
              <>
                {canDownloadDoc && !isFinalized && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      void downloadHtmlAsPdf({
                        title: viewDoc.subject,
                        html: viewDoc.body || "<p></p>",
                        meta: [
                          { label: "Owner", value: owner?.name ?? "" },
                          { label: "Ref", value: doc.refId ?? doc.id },
                          { label: "Version", value: `v${viewDoc.revisionNumber ?? activeRev}` },
                          { label: "Status", value: doc.status },
                        ],
                        fileName: viewDoc.subject.trim() || "document",
                      }).then(
                        () => toast.success("PDF downloaded"),
                        (e) => toast.error((e as Error).message || "Could not download PDF"),
                      );
                    }}
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" /> Download PDF
                  </Button>
                )}
                <PriorityBadge priority={viewDoc.priority} />
                <StatusBadge status={doc.status} />
                <SlaBadge sla={doc.sla} />
              </>
            )}
          </div>
        </div>
      </div>

      {viewingHistorical && (
        <div className="mx-6 mt-6 flex items-center gap-3 rounded-md border border-primary/25 bg-primary/5 px-4 py-3 text-sm">
          <span className="flex-1">
            Viewing <span className="font-mono font-medium">v{activeRev}</span> (read-only). Sequence chart,
            review activity, and document content are for this version.
          </span>
          <Button size="sm" variant="outline" onClick={() => setSelectedRev(null)}>
            Back to v{currentRev}
          </Button>
        </div>
      )}

      {isPendingCreatorSend && doc.ownerId === user.id && (
        <div className="mx-6 mt-6 space-y-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
          <p>Reviewer has completed their review. Send the document for approval when you are ready.</p>
          {completedReviewerNotes.length > 0 && (
            <div className="space-y-2 border-t border-amber-500/20 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-900/80 dark:text-amber-100/80">
                Reviewer feedback
              </p>
              {completedReviewerNotes.map((reviewer) => (
                <div key={reviewer.id} className="rounded-md border border-amber-500/20 bg-background/60 px-3 py-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {users.find((candidate) => candidate.id === reviewer.userId)?.name ?? reviewer.name}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{reviewer.reviewComment}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {isPendingReviewer && doc.ownerId === user.id && (
        <div className="mx-6 mt-6 rounded-md border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm text-violet-950 dark:text-violet-100">
          Waiting for reviewer to complete review. The approver will receive this document only after review is done and you send it for approval.
        </div>
      )}

      {isFinalized && (
        <div className="mx-6 mt-6 flex items-center gap-3 rounded-md border border-info/30 bg-info/10 px-4 py-3 text-sm">
          <Lock className="h-4 w-4 shrink-0 text-info" />
          <span className="flex-1">
            This document is finalized and locked. Contents are read-only and immutable.
          </span>
          {doc.archiveDocumentId && canDownloadDoc && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => downloadArchive("pdf")}>
                <Download className="mr-1.5 h-3.5 w-3.5" /> PDF
              </Button>
              <Button size="sm" variant="ghost" onClick={() => downloadArchive("html")}>
                HTML
              </Button>
            </div>
          )}
          {doc.archiveDocumentId && !canDownloadDoc && (
            <span className="text-xs text-muted-foreground">Download not permitted for your account.</span>
          )}
        </div>
      )}

      {isRejected && !showEditor && (
        <div className="mx-6 mt-6 flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="flex-1 space-y-1">
            <p className="font-medium text-destructive">This document was rejected.</p>
            <p className="text-muted-foreground">
              {rejectionStep?.comment ? `Reason: ${rejectionStep.comment}. ` : ""}
              {doc.ownerId === user.id
                ? "Click Update to revise (new version) and resubmit."
                : "Contents are view-only."}
            </p>
          </div>
          {doc.ownerId === user.id && (
            <Button size="sm" onClick={() => void runUpdate()} disabled={revising}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              {revising ? "Opening…" : "Update"}
            </Button>
          )}
        </div>
      )}

      {(isReturned || showEditor) && doc.ownerId === user.id && (
        <div className="mx-6 mt-6 flex items-start gap-3 rounded-md border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
          <Pencil className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div className="flex-1 space-y-1">
            <p className="font-medium">
              {showEditor ? `Editing v${doc.revisionNumber ?? 1}` : "Ready to update"}
            </p>
            <p className="text-muted-foreground">
              {showEditor
                ? "Change subject/body below, then Save or Resubmit for approval."
                : `Version v${doc.revisionNumber ?? 1} — click Update to edit and resubmit.`}
            </p>
          </div>
          {!showEditor && (
            <Button size="sm" onClick={() => void runUpdate()} disabled={revising}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Update
            </Button>
          )}
        </div>
      )}

      {isCancelled && (
        <div className="mx-6 mt-6 flex items-center gap-3 rounded-md border border-muted-foreground/20 bg-muted/40 px-4 py-3 text-sm">
          <XCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="flex-1">
            This document was cancelled
            {doc.cancelReason ? `: ${doc.cancelReason}` : "."}
          </span>
        </div>
      )}

      <div className="grid gap-5 p-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(380px,0.85fr)]">
        <div className="min-w-0 space-y-4">
          <Card className="overflow-hidden border-border/70 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between border-b py-3">
              <div>
                <CardTitle className="text-sm">
                  {showEditor ? "Edit document content" : "Document preview"}
                </CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {showEditor
                    ? "Changes are saved as the current revision"
                    : "Read-only approval copy"}
                </p>
              </div>
              <span className="rounded border bg-muted/50 px-2 py-1 font-mono text-[10px] uppercase text-muted-foreground">
                v{viewDoc.revisionNumber ?? activeRev}
              </span>
            </CardHeader>
            <CardContent className={showEditor ? "p-5" : "bg-muted/40 p-4 sm:p-8"}>
              {showEditor ? (
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  className="wysiwyg-content min-h-[520px] max-w-none rounded-md border bg-background p-6 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  onInput={() => {
                    const html = editorRef.current?.innerHTML ?? "";
                    setEditBody(isBodyEmpty(html) ? "" : html);
                  }}
                />
              ) : viewingHistorical && revisionDetailQ.isLoading ? (
                <div className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading version…
                </div>
              ) : (
                <article className="mx-auto min-h-[680px] max-w-[760px] border border-border/80 bg-card px-8 py-10 shadow-[0_8px_30px_rgba(15,23,42,0.08)] sm:px-12">
                  <div className="mb-8 border-b border-border pb-5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                      Document record
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight">{viewDoc.subject}</h2>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {doc.refId ?? `Document ${doc.id.slice(0, 8)}`} · {owner?.name}
                    </p>
                  </div>
                  <div
                    className="wysiwyg-content text-sm"
                    dangerouslySetInnerHTML={{ __html: viewDoc.body }}
                  />
                </article>
              )}
            </CardContent>
          </Card>
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="border-b py-3">
              <CardTitle className="text-sm">Supporting files</CardTitle>
            </CardHeader>
            <CardContent>
              <AttachmentList
                attachments={doc.attachments}
                onPreview={(a) => previewAttachment(a.id)}
              />
            </CardContent>
          </Card>
        </div>

        <aside className="min-w-0 space-y-4">
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="border-b py-3">
              <CardTitle className="text-sm">Record details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Workflow" value={workflow?.name} />
              <Row
                label="Type"
                value={workflow?.type === "financial" ? "Financial" : "Non-financial"}
              />
              <Row label="Version" value={`v${viewDoc.revisionNumber ?? activeRev}`} mono />
              {showEditor ? (
                <>
                  <div className="space-y-1.5 pt-1">
                    <Label>Amount</Label>
                    <Input
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Priority</Label>
                    <Select
                      value={editPriority}
                      onValueChange={(v) => setEditPriority(v as Priority)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Normal">Normal</SelectItem>
                        <SelectItem value="Urgent">Urgent</SelectItem>
                        <SelectItem value="Critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <>
                  {viewDoc.amount != null && <Row label="Amount" value={formatPKR(viewDoc.amount)} mono />}
                  <Row label="Priority" value={viewDoc.priority} />
                </>
              )}
              <Row label="Owner" value={owner?.name} />
              <Row label="Department" value={owner?.department} />
              {viewDoc.submittedAt && <Row label="Submitted" value={absTime(viewDoc.submittedAt)} />}
              {doc.finalizedAt && <Row label="Finalized" value={absTime(doc.finalizedAt)} />}
              {doc.cancelReason && <Row label="Cancel reason" value={doc.cancelReason} />}
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm">
            <CardHeader className="border-b py-3">
              <CardTitle className="text-sm">Sequence chart</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Sequential routing for v{activeRev} only
                {viewingHistorical ? " (this version)." : "."}
              </p>
            </CardHeader>
            <CardContent className="pt-4">
              {revisionDetailQ.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading version routing…
                </div>
              ) : (
                <ApprovalFlowChart nodes={buildDocumentFlowNodes(viewDoc, users)} mode="sequential" />
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between border-b py-3">
              <CardTitle className="text-sm">Workflow &amp; review activity</CardTitle>
              <Button variant="ghost" size="sm" onClick={exportAuditTrail}>
                Export JSON
              </Button>
            </CardHeader>
            <CardContent className="space-y-6 pt-5">
              <WorkflowStepper
                steps={viewDoc.steps}
                currentStepId={viewDoc.currentStepId}
                reviewers={viewDoc.reviewers}
                ownerId={viewDoc.ownerId}
                compact
              />
              <CommentThread comments={activityComments} />
              <ApprovalTrail steps={viewDoc.steps} currentStepId={viewDoc.currentStepId} />
            </CardContent>
          </Card>

          <div className="sticky top-28 space-y-2 rounded-xl border border-border/70 bg-card p-3 shadow-sm">
            {showEditor && (
              <>
                <Button
                  className="w-full"
                  disabled={saving || !editSubject.trim()}
                  onClick={() => setConfirmResubmit(true)}
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  Resubmit for approval
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={saving || !editSubject.trim()}
                  onClick={() => void saveDocument(false)}
                >
                  Save without submitting
                </Button>
              </>
            )}

            {canSendForApproval && !showEditor && (
              <Button className="w-full" disabled={sendingForApproval} onClick={() => setConfirmSendForApproval(true)}>
                {sendingForApproval ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                Send for approval
              </Button>
            )}

            {canFinalize && !showEditor && (
              <Button className="w-full" onClick={() => setFinalize(true)}>
                <Hash className="mr-2 h-4 w-4" /> Finalize document
              </Button>
            )}

            {canCancel && !showEditor && (
              <Button
                variant="outline"
                className="w-full text-destructive hover:text-destructive"
                onClick={() => setCancel(true)}
              >
                <XCircle className="mr-2 h-4 w-4" /> Cancel document
              </Button>
            )}

            {canDelete && !showEditor && (
              <Button
                variant="outline"
                className="w-full text-destructive hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete document
              </Button>
            )}
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmSendForApproval}
        onOpenChange={setConfirmSendForApproval}
        title="Send for approval?"
        description="The document will go to the assigned approver(s). Make sure the reviewer feedback has been addressed."
        confirmLabel="Send for approval"
        onConfirm={() => void runSendForApproval()}
      />

      <ConfirmDialog
        open={confirmResubmit}
        onOpenChange={setConfirmResubmit}
        title="Resubmit this version?"
        description={`Version v${doc.revisionNumber ?? 1} will go through approval again.`}
        confirmLabel="Resubmit"
        onConfirm={() => saveDocument(true)}
      />

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
