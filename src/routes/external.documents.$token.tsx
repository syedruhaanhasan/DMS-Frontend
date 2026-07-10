import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ExternalShell } from "./external.login";
import { wdas } from "@/services/wdas";
import { useUserById } from "@/lib/wdas/users-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState } from "@/components/wdas/data-states";
import { ConfirmDialog } from "@/components/wdas/confirm-dialog";
import { formatPKR, relTime, absTime } from "@/lib/wdas/format";
import { StatusBadge } from "@/components/wdas/badges";
import { FileText, Check, X, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/external/documents/$token")({
  component: ExternalDocumentView,
});

function readExternalDocumentId(): string | null {
  try {
    const raw = sessionStorage.getItem("wdas.externalSession");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { documentId?: string };
    return parsed.documentId ?? null;
  } catch {
    return null;
  }
}

function ExternalDocumentView() {
  const router = useRouter();
  const docId = readExternalDocumentId() ?? "";
  const q = useQuery({
    queryKey: ["doc", "external", docId],
    queryFn: () => wdas.getDocument(docId),
    enabled: !!docId,
  });

  const [comment, setComment] = useState("");
  const [confirm, setConfirm] = useState<"approve" | "reject" | null>(null);
  const owner = useUserById(q.data?.ownerId);

  const run = async (action: "approve" | "reject") => {
    if (action === "reject" && !comment.trim()) return;
    if (!docId) return;
    try {
      await wdas.actOnDocument(docId, action, comment);
      toast.success(action === "approve" ? "Approval submitted" : "Rejection submitted", {
        description: "Your response has been recorded.",
      });
      sessionStorage.removeItem("wdas.externalSession");
      router.navigate({ to: "/external/expired" });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (!docId) {
    return (
      <ExternalShell>
        <ErrorState message="No active external session. Verify your one-time code first." />
      </ExternalShell>
    );
  }

  if (q.isLoading) return <ExternalShell><LoadingState /></ExternalShell>;
  if (q.isError || !q.data) {
    return (
      <ExternalShell>
        <ErrorState message="This document could not be loaded. The link may be invalid." />
      </ExternalShell>
    );
  }

  const doc = q.data;
  const ownerLabel = doc.ownerName ?? owner?.name ?? "—";

  return (
    <ExternalShell>
      <div className="mx-auto max-w-2xl space-y-4">
        <Card>
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="border-info/40 bg-info/10 text-info">
                <ShieldCheck className="mr-1 h-3 w-3" /> Verified external session
              </Badge>
              <StatusBadge status={doc.status} />
            </div>
            <CardTitle className="text-xl">{doc.subject}</CardTitle>
            <p className="text-xs text-muted-foreground">
              From {ownerLabel} · {owner?.department ?? "—"} · Submitted {relTime(doc.submittedAt ?? doc.createdAt)}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {doc.amount != null && (
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <p className="text-xs text-muted-foreground">Requested amount</p>
                <p className="mt-0.5 font-mono text-lg font-semibold">{formatPKR(doc.amount)}</p>
              </div>
            )}
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Document body</p>
              <div className="prose prose-sm max-w-none rounded-md border bg-card p-3 text-sm" dangerouslySetInnerHTML={{ __html: doc.body }} />
            </div>
            {doc.attachments.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Attachments (read-only)</p>
                <ul className="space-y-1">
                  {doc.attachments.map((a) => (
                    <li key={a.id} className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2 text-sm">
                      <span className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" /> {a.name}</span>
                      <span className="text-xs text-muted-foreground">{a.size}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {doc.steps.some((s) => s.comment) && (
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Prior comments</p>
                <ul className="space-y-2">
                  {doc.steps.filter((s) => s.comment).map((s) => (
                    <StepComment key={s.id} stepId={s.id} approverId={s.approverId} comment={s.comment!} actedAt={s.actedAt} />
                  ))}
                </ul>
              </div>
            )}
            <div className="space-y-2 border-t pt-4">
              <Label htmlFor="comment">Comment (required for rejection)</Label>
              <Textarea id="comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="Add context for your decision…" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button className="flex-1" onClick={() => setConfirm("approve")}><Check className="mr-1 h-4 w-4" /> Approve</Button>
              <Button variant="destructive" className="flex-1" onClick={() => setConfirm("reject")}><X className="mr-1 h-4 w-4" /> Reject</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm === "approve" ? "Approve this document?" : "Reject this document?"}
        description={confirm === "approve" ? "This will record your approval." : "This will reject the document and notify the owner."}
        confirmLabel={confirm === "approve" ? "Approve" : "Reject"}
        variant={confirm === "approve" ? "success" : "destructive"}
        requireReason={confirm === "reject"}
        onConfirm={() => confirm && run(confirm)}
      />
    </ExternalShell>
  );
}

function StepComment({ approverId, comment, actedAt }: { stepId: string; approverId: string; comment: string; actedAt?: string }) {
  const user = useUserById(approverId);
  return (
    <li className="rounded-md border p-3 text-sm">
      <div className="flex items-center justify-between">
        <p className="font-medium">{user?.name ?? "Approver"}</p>
        <span className="text-xs text-muted-foreground">{actedAt ? absTime(actedAt) : "—"}</span>
      </div>
      <p className="mt-1 text-muted-foreground">{comment}</p>
    </li>
  );
}
