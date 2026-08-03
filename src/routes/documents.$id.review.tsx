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
import { ApprovalFlowChart, buildDocumentFlowNodes } from "@/components/wdas/approval-flow-chart";
import { WorkflowStepper } from "@/components/wdas/workflow-stepper";
import { CommentThread } from "@/components/wdas/comment-thread";
import { AttachmentList } from "@/components/wdas/attachments";
import { LoadingState, ErrorState } from "@/components/wdas/data-states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/wdas/confirm-dialog";
import { formatPKR } from "@/lib/wdas/format";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  Clock3,
  Download,
  Eye,
  FileText,
  Loader2,
  Paperclip,
  RotateCcw,
  ShieldCheck,
  UserPlus,
  X,
} from "lucide-react";
import { downloadHtmlAsPdf } from "@/lib/wdas/download-html-pdf";

export const Route = createFileRoute("/documents/$id/review")({
  component: ReviewPage,
});

function ReviewPage() {
  const { id } = Route.useParams();
  const { user, role } = useSession();
  const { users } = useUsers();
  const qc = useQueryClient();
  const router = useRouter();

  const canFetch = useCanFetchDocuments();
  const q = useDocumentQuery(id);
  const owner = useUserById(q.data?.ownerId);
  const [comment, setComment] = useState("");
  const [confirm, setConfirm] = useState<"approve" | "reject" | "return" | null>(null);
  const [reviewerQuery, setReviewerQuery] = useState("");
  const [reviewerFocused, setReviewerFocused] = useState(false);
  const [addingReviewer, setAddingReviewer] = useState(false);
  const [completingReview, setCompletingReview] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const attachInputRef = useRef<HTMLInputElement>(null);

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
  const reviewers = doc.reviewers ?? [];
  const myReviewerRecord = reviewers.find((r) => r.userId === user.id);
  const isReviewer = Boolean(myReviewerRecord);
  const isGatedReview =
    doc.status === "pending_reviewer" && isReviewer && !myReviewerRecord?.reviewedAt;
  const isApproverGatedReview =
    isGatedReview &&
    Boolean(myReviewerRecord?.addedById && myReviewerRecord.addedById !== doc.ownerId);
  const isYourTurn =
    currentStep?.approverId === user.id &&
    (doc.status === "pending" || doc.status === "ready_to_finalize");
  const awaitingReviewerIAdded = (doc.reviewers ?? []).some(
    (r) => r.addedById === user.id && !r.reviewedAt,
  );
  const waitingForMyReviewer = doc.status === "pending_reviewer" && awaitingReviewerIAdded;
  const reviewerFeedbackForMe = (doc.reviewers ?? []).filter(
    (r) => r.addedById === user.id && r.reviewComment?.trim() && r.reviewedAt,
  );
  const activityComments = [
    ...(doc.reviewers ?? [])
      .filter((r) => r.reviewComment?.trim() && r.reviewedAt)
      .map((r) => ({
        id: `reviewer-${r.id}`,
        author: users.find((u) => u.id === r.userId)?.name ?? r.name,
        role: "Reviewer",
        timestamp: r.reviewedAt!,
        body: r.reviewComment!,
        action: "review" as const,
      })),
    ...doc.steps
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
      })),
  ];
  const canComment = isYourTurn || isGatedReview;
  const reviewerOnly = isGatedReview || (isReviewer && !isYourTurn);
  const alreadyAddedByMe = reviewers.some((r) => r.addedById === user.id);
  const canAddReviewer = isYourTurn && !alreadyAddedByMe;
  const canDownloadDoc =
    role === "super_admin" ||
    role === "auditor" ||
    (doc.downloadAllowedUserIds ?? []).map(String).includes(String(user.id));

  const downloadDocumentPdf = async () => {
    setDownloadingPdf(true);
    try {
      if (doc.archiveDocumentId) {
        await wdas.downloadArchive(doc.archiveDocumentId, "pdf", doc.subject.trim() || undefined);
      } else {
        await downloadHtmlAsPdf({
          title: doc.subject,
          html: doc.body || "<p></p>",
          meta: [
            { label: "Owner", value: owner?.name ?? "" },
            { label: "Ref", value: doc.refId ?? doc.id },
            { label: "Status", value: doc.status },
          ],
          fileName: doc.subject.trim() || "document",
        });
      }
      toast.success("PDF downloaded");
    } catch (e) {
      toast.error((e as Error).message || "Could not download PDF");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const reviewerCandidates = users.filter((u) => {
    if (u.id === user.id) return false;
    if (reviewers.some((r) => r.userId === u.id)) return false;
    if (!reviewerQuery.trim()) return true;
    const query = reviewerQuery.toLowerCase();
    return (
      u.name.toLowerCase().includes(query) ||
      (u.designation ?? "").toLowerCase().includes(query) ||
      (u.department ?? "").toLowerCase().includes(query)
    );
  });
  const showReviewerPicker = reviewerFocused || reviewerQuery.trim().length > 0;

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

  const completeReview = async () => {
    if (!comment.trim()) {
      toast.error("Enter your review notes before completing");
      return;
    }
    setCompletingReview(true);
    try {
      const updated = await wdas.completeReviewerReview(doc.id, comment);
      await refreshWorkflowViews(qc, { userId: user.id, document: updated });
      setComment("");
      toast.success(
        updated.status === "pending"
          ? "Review completed — document returned to approver"
          : "Review completed — document returned to creator",
      );
      router.navigate({ to: reviewerOnly ? "/review-inbox" : "/inbox" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCompletingReview(false);
    }
  };

  const saveComment = async () => {
    if (!comment.trim()) {
      toast.error("Enter a comment");
      return;
    }
    if (isGatedReview) {
      await completeReview();
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

  const addReviewer = async (reviewerUserId: string) => {
    setAddingReviewer(true);
    try {
      const updated = await wdas.addReviewer(doc.id, reviewerUserId);
      await refreshWorkflowViews(qc, { userId: user.id, document: updated });
      await q.refetch();
      setReviewerQuery("");
      setReviewerFocused(false);
      toast.success("Reviewer added — they will review first, then the document returns to you");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAddingReviewer(false);
    }
  };

  const runAction = async (reason?: string) => {
    if (!confirm) return;
    const note = (reason ?? comment).trim();
    if (!note) {
      toast.error("A comment is required before you can approve or decide.");
      return;
    }
    try {
      const updated = await wdas.actOnDocument(doc.id, confirm, note, user.id);
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

  const uploadApproverAttachment = async (file: File | undefined) => {
    if (!file || !isYourTurn) return;
    setUploadingAttachment(true);
    try {
      await wdas.uploadAttachment(doc.id, file);
      await q.refetch();
      toast.success("Attachment added");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploadingAttachment(false);
      if (attachInputRef.current) attachInputRef.current.value = "";
    }
  };

  return (
    <div className="min-h-full bg-muted/20">
      <div className="sticky top-0 z-20 border-b border-border/70 bg-card/95 px-6 py-3 shadow-sm backdrop-blur">
        <div className="mb-3 flex items-center gap-2 text-sm">
          <Button asChild variant="ghost" size="sm" className="-ml-2 h-7 gap-1">
            <Link to={reviewerOnly ? "/review-inbox" : "/inbox"}>
              <ArrowLeft className="h-4 w-4" /> {reviewerOnly ? "Back to Reviewer Inbox" : "Approval Box"}
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
            {canDownloadDoc && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={downloadingPdf}
                onClick={() => void downloadDocumentPdf()}
              >
                {downloadingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                Download PDF
              </Button>
            )}
            <PriorityBadge priority={doc.priority} />
            <StatusBadge status={doc.status} />
            <SlaBadge sla={doc.sla} />
            <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
              <Clock3 className="h-3 w-3" /> {doc.daysPending}d pending
            </span>
          </div>
        </div>
      </div>

      {waitingForMyReviewer && (
        <div className="mx-6 rounded-md border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm text-violet-950 dark:text-violet-100">
          Waiting for your reviewer to finish. You can approve or reject once they complete their review.
        </div>
      )}

      {isYourTurn && reviewerFeedbackForMe.length > 0 && (
        <div className="mx-6 space-y-2 rounded-md border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
          <p className="font-medium">Reviewer feedback</p>
          {reviewerFeedbackForMe.map((r) => (
            <div key={r.id} className="rounded-md border border-border/70 bg-background/80 px-3 py-2">
              <p className="text-xs font-medium text-muted-foreground">{r.name}</p>
              <p className="mt-1 whitespace-pre-wrap">{r.reviewComment}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-5 p-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(380px,0.85fr)]">
        <div className="min-w-0 space-y-4">
          <Card className="overflow-hidden border-border/70 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between border-b bg-card py-3">
              <div>
                <CardTitle className="text-sm">Document preview</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">Read-only approval copy</p>
              </div>
              <div className="flex items-center gap-2">
                {canDownloadDoc && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5"
                    disabled={downloadingPdf}
                    onClick={() => void downloadDocumentPdf()}
                  >
                    {downloadingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    Download PDF
                  </Button>
                )}
                <span className="rounded border bg-muted/50 px-2 py-1 font-mono text-[10px] uppercase text-muted-foreground">
                  Content
                </span>
              </div>
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
                  className="wysiwyg-content text-sm"
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
              <CardTitle className="text-sm">Sequence chart</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Each reviewer appears right after whoever added them.
              </p>
            </CardHeader>
            <CardContent className="pt-4">
              <ApprovalFlowChart nodes={buildDocumentFlowNodes(doc, users)} mode="sequential" />
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm">
            <CardHeader className="border-b py-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Eye className="h-4 w-4 text-muted-foreground" /> Reviewers
              </CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                When you add a reviewer, they review first — then the document returns to you to approve.
              </p>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {reviewers.length > 0 ? (
                <ul className="space-y-1.5">
                  {reviewers.map((r) => {
                    const addedBy = r.addedById ? users.find((u) => u.id === r.addedById) : undefined;
                    return (
                      <li
                        key={r.id}
                        className="flex items-center justify-between gap-2 rounded-md border border-border/70 bg-muted/30 px-2.5 py-1.5 text-sm"
                      >
                        <span className="min-w-0 truncate">{r.name}</span>
                        {addedBy && (
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            added by {addedBy.id === user.id ? "you" : addedBy.name}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">No reviewers yet.</p>
              )}

              {isYourTurn && (
                alreadyAddedByMe ? (
                  <p className="rounded-md bg-muted/50 p-2.5 text-xs text-muted-foreground">
                    You have already added your reviewer for this document.
                  </p>
                ) : (
                  <div className="relative">
                    <div className="relative">
                      <UserPlus className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        className="pl-8"
                        placeholder="Add a reviewer…"
                        value={reviewerQuery}
                        onChange={(e) => setReviewerQuery(e.target.value)}
                        onFocus={() => setReviewerFocused(true)}
                        onBlur={() => window.setTimeout(() => setReviewerFocused(false), 150)}
                        disabled={addingReviewer}
                      />
                    </div>
                    {showReviewerPicker && (
                      <div className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-md">
                        {reviewerCandidates.length > 0 ? (
                          reviewerCandidates.slice(0, 25).map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60 disabled:opacity-50"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => void addReviewer(u.id)}
                              disabled={addingReviewer}
                            >
                              <span className="flex-1 truncate">
                                <span className="font-medium">{u.name}</span>
                                {(u.designation || u.department) && (
                                  <span className="text-muted-foreground">
                                    {" "}
                                    · {u.designation || u.department}
                                  </span>
                                )}
                              </span>
                            </button>
                          ))
                        ) : (
                          <p className="px-3 py-2 text-xs text-muted-foreground">
                            {reviewerQuery.trim() ? "No matching users." : "No other active users available."}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm">
            <CardHeader className="border-b py-3">
              <CardTitle className="text-sm">Review activity</CardTitle>
            </CardHeader>
            <CardContent className="max-h-[340px] space-y-6 overflow-y-auto pt-4">
              <CommentThread comments={activityComments} />
              <ApprovalTrail steps={doc.steps} currentStepId={doc.currentStepId} />
            </CardContent>
          </Card>

          <div className="sticky top-32">
            <Card className="border-primary/20 shadow-md">
              <CardHeader className="border-b bg-primary/[0.045] py-3">
                <CardTitle className="text-sm">
                  {reviewerOnly
                    ? "Your review"
                    : isYourTurn
                      ? "Approval decision"
                      : "Actions unavailable"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {reviewerOnly && (
                  <p className="rounded-md bg-info/10 p-3 text-xs text-muted-foreground">
                    {isGatedReview
                      ? isApproverGatedReview
                        ? "Complete your review to return this document to the approver who requested it."
                        : "Complete your review to return this document to the creator. It will only go to the approver after the creator sends it for approval."
                      : "You were added as an informational reviewer. You can read the document and leave comments — approval is handled by the assigned approvers."}
                  </p>
                )}
                {!isYourTurn && !reviewerOnly && (
                  <p className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                    {doc.status !== "pending"
                      ? "This document is no longer awaiting action."
                      : `Currently awaiting ${users.find((u) => u.id === currentStep?.approverId)?.name ?? "another approver"}.`}
                  </p>
                )}
                <div className="space-y-2">
                  <Label htmlFor="cmt">
                    Comment <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="cmt"
                    rows={4}
                    placeholder={
                      reviewerOnly
                        ? "Add your review notes…"
                        : "Comment is required before you can approve…"
                    }
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    disabled={!canComment}
                  />
                </div>
                {!reviewerOnly && (
                  <div className="space-y-2">
                    <Label>Attachment (optional)</Label>
                    <input
                      ref={attachInputRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => void uploadApproverAttachment(e.target.files?.[0])}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full justify-start gap-2"
                      disabled={!isYourTurn || uploadingAttachment}
                      onClick={() => attachInputRef.current?.click()}
                    >
                      {uploadingAttachment ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Paperclip className="h-4 w-4" />
                      )}
                      {uploadingAttachment ? "Uploading…" : "Attach file"}
                    </Button>
                  </div>
                )}
                <div className="grid gap-2 pt-2">
                  {reviewerOnly ? (
                    <Button
                      type="button"
                      onClick={() => void completeReview()}
                      disabled={!comment.trim() || completingReview}
                      className="h-11 text-sm font-semibold"
                    >
                      {completingReview ? "Completing…" : "Complete review"}
                    </Button>
                  ) : (
                    <>
                      <Button
                        onClick={() => setConfirm("approve")}
                        disabled={!isYourTurn || !comment.trim()}
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
                    </>
                  )}
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
            ? "Your comment will be recorded with this approval."
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
