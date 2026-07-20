import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/wdas/page-header";
import { wdas } from "@/services/wdas";
import { useSession } from "@/lib/wdas/role-context";
import { Card, CardContent } from "@/components/ui/card";
import { DocumentTable } from "@/components/wdas/document-table";
import { LoadingState, ErrorState, EmptyState } from "@/components/wdas/data-states";
import { AlertTriangle, Clock3, Eye, Inbox, ListFilter, ShieldCheck } from "lucide-react";
import { DelegationBanner } from "@/components/wdas/delegation-banner";
import { useState } from "react";
import { ConfirmDialog } from "@/components/wdas/confirm-dialog";
import { useCanFetchDocuments } from "@/lib/wdas/use-document-query";
import { refreshWorkflowViews } from "@/lib/wdas/refresh-workflow-queries";
import { toast } from "sonner";

export const Route = createFileRoute("/inbox")({
  component: InboxPage,
});

function InboxPage() {
  const { user } = useSession();
  const qc = useQueryClient();
  const canFetch = useCanFetchDocuments();
  const q = useQuery({
    queryKey: ["docs", "approver", user.id],
    queryFn: () => wdas.listDocuments({ approverId: user.id }),
    enabled: canFetch && !!user.id,
  });
  const reviewQ = useQuery({
    queryKey: ["docs", "review", user.id],
    queryFn: () => wdas.listReviewDocuments(),
    enabled: canFetch && !!user.id,
  });
  const [confirm, setConfirm] = useState<{
    id: string;
    action: "approve" | "reject";
    stepId?: string;
  } | null>(null);
  const [filter, setFilter] = useState<"all" | "overdue" | "at_risk" | "priority">("all");

  const fifoDocs = [...(q.data ?? [])].sort(
    (a, b) =>
      new Date(a.submittedAt ?? a.createdAt).getTime() -
      new Date(b.submittedAt ?? b.createdAt).getTime(),
  );
  const filteredDocs = fifoDocs.filter((doc) => {
    if (filter === "overdue") return doc.sla === "overdue";
    if (filter === "at_risk") return doc.sla === "at_risk";
    if (filter === "priority") return doc.priority !== "Normal";
    return true;
  });
  const filterOptions = [
    { id: "all" as const, label: "All items", count: fifoDocs.length },
    {
      id: "overdue" as const,
      label: "Overdue",
      count: fifoDocs.filter((d) => d.sla === "overdue").length,
    },
    {
      id: "at_risk" as const,
      label: "At risk",
      count: fifoDocs.filter((d) => d.sla === "at_risk").length,
    },
    {
      id: "priority" as const,
      label: "Priority",
      count: fifoDocs.filter((d) => d.priority !== "Normal").length,
    },
  ];

  const runAction = async (reason?: string) => {
    if (!confirm) return;
    try {
      const updated = await wdas.actOnDocument(
        confirm.id,
        confirm.action,
        reason ?? "Approved from inbox",
        user.id,
        confirm.stepId,
      );
      await refreshWorkflowViews(qc, { userId: user.id, document: updated });
      await q.refetch();
      setConfirm(null);
      toast.success(confirm.action === "approve" ? "Approved" : "Rejected");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="min-h-full bg-muted/20">
      <PageHeader
        title="Approval Box"
        subtitle="Documents awaiting your approval, plus any shared with you for informational review."
      />
      <DelegationBanner />
      <div className="space-y-4 p-6">
        {(reviewQ.data?.length ?? 0) > 0 && (
          <Card className="overflow-hidden border-info/30 shadow-sm">
            <div className="flex flex-col gap-1 border-b border-info/20 bg-info/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <Eye className="h-4 w-4 text-info" />
                  For your review
                </h2>
                <p className="text-xs text-muted-foreground">
                  Documents awaiting your approval, plus any waiting for your review before they can go to approvers.
                </p>
              </div>
              <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-info/15 px-2 text-xs font-semibold text-info">
                {reviewQ.data?.length ?? 0}
              </span>
            </div>
            <CardContent className="p-0">
              {reviewQ.isFetching && !reviewQ.data ? (
                <LoadingState />
              ) : reviewQ.isError ? (
                <ErrorState message="Could not load review documents." onRetry={() => reviewQ.refetch()} />
              ) : (
                <DocumentTable docs={reviewQ.data ?? []} showStatus />
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Awaiting action <Inbox className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{fifoDocs.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">Assigned to your queue</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              SLA attention <AlertTriangle className="h-4 w-4 text-warning" />
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-tight">
              {fifoDocs.filter((d) => d.sla !== "on_time").length}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">At risk or overdue</p>
          </div>
          <div className="rounded-xl border border-primary/20 bg-primary/[0.06] p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Queue policy <ShieldCheck className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-2 text-sm font-semibold">FIFO · Oldest first</p>
            <p className="mt-1 text-xs text-muted-foreground">Submitted order is preserved</p>
          </div>
        </div>

        <Card className="overflow-hidden border-border/70 shadow-sm">
          <div className="flex flex-col gap-3 border-b bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold">Enterprise approval queue</h2>
              <p className="text-xs text-muted-foreground">
                Action the oldest eligible item first.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5" aria-label="Queue filters">
              <ListFilter className="mr-1 h-4 w-4 text-muted-foreground" />
              {filterOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setFilter(option.id)}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors ${
                    filter === option.id
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {option.label}
                  <span className="rounded-full bg-foreground/5 px-1.5 py-0.5 font-mono text-[10px]">
                    {option.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <CardContent className="p-0">
            {q.isFetching && !q.data ? (
              <LoadingState />
            ) : q.isError ? (
              <ErrorState message="Could not load inbox." onRetry={() => q.refetch()} />
            ) : !q.data?.length ? (
              <EmptyState
                icon={<Inbox className="h-8 w-8" />}
                title="Inbox is clear"
                description="No documents currently need your action."
              />
            ) : !filteredDocs.length ? (
              <EmptyState
                icon={<Clock3 className="h-8 w-8" />}
                title="No matching items"
                description="Try another queue filter."
              />
            ) : (
              <DocumentTable
                docs={filteredDocs}
                showActions="approver"
                onApprove={(id) => {
                  const doc = q.data?.find((d) => d.id === id);
                  setConfirm({ id, action: "approve", stepId: doc?.currentStepId });
                }}
                onReject={(id) => {
                  const doc = q.data?.find((d) => d.id === id);
                  setConfirm({ id, action: "reject", stepId: doc?.currentStepId });
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm?.action === "approve" ? "Approve document?" : "Reject document?"}
        confirmLabel={confirm?.action === "approve" ? "Approve" : "Reject"}
        variant={confirm?.action === "approve" ? "success" : "destructive"}
        requireReason={confirm?.action === "reject"}
        onConfirm={runAction}
      />
    </div>
  );
}
