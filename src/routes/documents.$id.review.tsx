import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { wdas } from "@/services/wdas";
import { useSession } from "@/lib/wdas/role-context";
import { useDocumentQuery, useCanFetchDocuments } from "@/lib/wdas/use-document-query";
import { refreshWorkflowViews } from "@/lib/wdas/refresh-workflow-queries";
import { useUserById, useUsers } from "@/lib/wdas/users-context";
import { getToken, ApiError } from "@/lib/api/client";
import { apiPath } from "@/lib/api/client";
import { StatusBadge, SlaBadge, PriorityBadge } from "@/components/wdas/badges";
import { ApprovalTrail } from "@/components/wdas/approval-trail";
import { WorkflowStepper } from "@/components/wdas/workflow-stepper";
import { CommentThread } from "@/components/wdas/comment-thread";
import { AttachmentList } from "@/components/wdas/attachments";
import { LoadingState, ErrorState } from "@/components/wdas/data-states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/wdas/confirm-dialog";
import { formatPKR } from "@/lib/wdas/format";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  Clock3,
  FileText,
  Paperclip,
  RotateCcw,
  ShieldCheck,
  X,
} from "lucide-react";

export const Route = createFileRoute("/documents/$id/review")({
  component: ReviewPage,
});

function ReviewPage() {
  const { id } = Route.useParams();
  const { user } = useSession();
  const { users } = useUsers();
  const qc = useQueryClient();
  const router = useRouter();

  const canFetch = useCanFetchDocuments();
  const q = useDocumentQuery(id);
  const owner = useUserById(q.data?.ownerId);
  const [comment, setComment] = useState("");
  const [confirm, setConfirm] = useState<"approve" | "reject" | "return" | null>(null);

  useEffect(() => {
    if (q.data && user.id && q.data.ownerId === user.id) {
      router.navigate({ to: "/documents/$id", params: { id } });
    }
  }, [q.data, user.id, id, router]);

  if (!canFetch) return <LoadingState />;
  if (q.isLoading) return <LoadingState />;
  if (q.isError || !q.data) {
    const message = q.error instanceof ApiError ? q.error.message : "Document not available.";
    return <ErrorState message={message} onRetry={() => q.refetch()} />;
  }

  const doc = q.data;
  const currentStep = doc.steps.find((s) => s.id === doc.currentStepId);
  const isYourTurn =
    currentStep?.approverId === user.id &&
    (doc.status === "pending" || doc.status === "ready_to_finalize");

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

  const saveComment = async () => {
    if (!comment.trim()) {
      toast.error("Enter a comment");
      return;
    }
    try {
      const updated = await wdas.commentOnDocument(doc.id, comment);
      await refreshWorkflowViews(qc, { userId: user.id, document: updated });
      setComment("");
      toast.success("Comment saved");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const runAction = async (reason?: string) => {
    if (!confirm) return;
    try {
      const updated = await wdas.actOnDocument(doc.id, confirm, reason ?? comment, user.id);
      await refreshWorkflowViews(qc, { userId: user.id, document: updated });
      toast.success(
        confirm === "approve"
          ? "Approved"
          : confirm === "reject"
            ? "Rejected"
            : "Returned for correction",
      );
      router.navigate({ to: "/inbox" });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="min-h-full bg-muted/20">
      <div className="sticky top-0 z-20 border-b border-border/70 bg-card/95 px-6 py-3 shadow-sm backdrop-blur">
        <div className="mb-3 flex items-center gap-2 text-sm">
          <Button asChild variant="ghost" size="sm" className="-ml-2 h-7 gap-1">
            <Link to="/inbox">
              <ArrowLeft className="h-4 w-4" /> Approval Box
            </Link>
          </Button>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="rounded-md border border-primary/20 bg-primary/[0.07] p-1.5 text-primary">
                <FileText className="h-4 w-4" />
              </span>
              <h1 className="truncate text-xl font-semibold tracking-tight">{doc.subject}</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              From {owner?.name} · {owner?.designation}, {owner?.department}
              {doc.amount != null && (
                <>
                  {" "}
                  · <span className="font-mono">{formatPKR(doc.amount)}</span>
                </>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PriorityBadge priority={doc.priority} />
            <StatusBadge status={doc.status} />
            <SlaBadge sla={doc.sla} />
            <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
              <Clock3 className="h-3 w-3" /> {doc.daysPending}d pending
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-5 p-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(380px,0.85fr)]">
        <div className="min-w-0 space-y-4">
          <Card className="overflow-hidden border-border/70 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between border-b bg-card py-3">
              <div>
                <CardTitle className="text-sm">Document preview</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">Read-only approval copy</p>
              </div>
              <span className="rounded border bg-muted/50 px-2 py-1 font-mono text-[10px] uppercase text-muted-foreground">
                Content
              </span>
            </CardHeader>
            <CardContent className="bg-muted/40 p-4 sm:p-8">
              <article className="mx-auto min-h-[680px] max-w-[760px] border border-border/80 bg-card px-8 py-10 shadow-[0_8px_30px_rgba(15,23,42,0.08)] sm:px-12">
                <div className="mb-8 border-b border-border pb-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                    Approval document
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">{doc.subject}</h2>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Submitted by {owner?.name} · {doc.refId ?? `Document ${doc.id.slice(0, 8)}`}
                  </p>
                </div>
                <div
                  className="prose prose-sm max-w-none [&_p]:my-3"
                  dangerouslySetInnerHTML={{ __html: doc.body }}
                />
              </article>
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm">
            <CardHeader className="border-b py-3">
              <CardTitle className="text-sm">Supporting files</CardTitle>
            </CardHeader>
            <CardContent>
              <AttachmentList
                attachments={doc.attachments}
                onPreview={(a) => void previewAttachment(a.id)}
              />
            </CardContent>
          </Card>
        </div>

        <aside className="min-w-0 space-y-4">
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="border-b py-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <ShieldCheck className="h-4 w-4 text-primary" /> Approval workflow
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              <WorkflowStepper steps={doc.steps} currentStepId={doc.currentStepId} compact />
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm">
            <CardHeader className="border-b py-3">
              <CardTitle className="text-sm">Review activity</CardTitle>
            </CardHeader>
            <CardContent className="max-h-[340px] space-y-6 overflow-y-auto pt-4">
              <CommentThread
                comments={doc.steps
                  .filter((s) => s.comment && s.actedAt)
                  .map((s) => ({
                    id: s.id,
                    author: users.find((u) => u.id === s.approverId)?.name ?? "Approver",
                    role: users.find((u) => u.id === s.approverId)?.designation,
                    timestamp: s.actedAt!,
                    body: s.comment!,
                    action:
                      s.status === "approved"
                        ? ("approved" as const)
                        : s.status === "rejected"
                          ? ("rejected" as const)
                          : s.status === "returned"
                            ? ("returned" as const)
                            : ("comment" as const),
                    attachmentName: s.attachmentName,
                  }))}
              />
              <ApprovalTrail steps={doc.steps} currentStepId={doc.currentStepId} />
            </CardContent>
          </Card>

          <div className="sticky top-32">
            <Card className="border-primary/20 shadow-md">
              <CardHeader className="border-b bg-primary/[0.045] py-3">
                <CardTitle className="text-sm">
                  {isYourTurn ? "Approval decision" : "Actions unavailable"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!isYourTurn && (
                  <p className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                    {doc.status !== "pending"
                      ? "This document is no longer awaiting action."
                      : `Currently awaiting ${users.find((u) => u.id === currentStep?.approverId)?.name ?? "another approver"}.`}
                  </p>
                )}
                <div className="space-y-2">
                  <Label htmlFor="cmt">Comment</Label>
                  <Textarea
                    id="cmt"
                    rows={4}
                    placeholder="Add your notes…"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    disabled={!isYourTurn}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Attachment (optional)</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2"
                    disabled={!isYourTurn}
                  >
                    <Paperclip className="h-4 w-4" /> Attach file
                  </Button>
                </div>
                <div className="grid gap-2 pt-2">
                  <Button
                    onClick={() => setConfirm("approve")}
                    disabled={!isYourTurn}
                    className="h-11 text-sm font-semibold"
                  >
                    <Check className="mr-2 h-4 w-4" /> Approve document
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={saveComment}
                    disabled={!isYourTurn || !comment.trim()}
                  >
                    Save comment only
                  </Button>
                  <Button
                    onClick={() => setConfirm("return")}
                    disabled={!isYourTurn}
                    variant="ghost"
                    className="text-warning-foreground hover:bg-warning/10"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" /> Return for Correction
                  </Button>
                  <Button
                    onClick={() => setConfirm("reject")}
                    disabled={!isYourTurn}
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="mr-2 h-4 w-4" /> Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={
          confirm === "approve"
            ? "Approve this document?"
            : confirm === "reject"
              ? "Reject this document?"
              : "Return for correction?"
        }
        description={
          confirm === "approve"
            ? "This will forward to the next approver or finalize the document."
            : confirm === "reject"
              ? "This will reject the document. A reason is required."
              : "The document will be returned to the owner for correction. A reason is required."
        }
        variant={
          confirm === "approve" ? "success" : confirm === "reject" ? "destructive" : "warning"
        }
        confirmLabel={
          confirm === "approve" ? "Approve" : confirm === "reject" ? "Reject" : "Return"
        }
        requireReason={confirm === "reject" || confirm === "return"}
        onConfirm={runAction}
      />
    </div>
  );
}
