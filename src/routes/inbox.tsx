import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/wdas/page-header";
import { wdas } from "@/services/wdas";
import { useSession } from "@/lib/wdas/role-context";
import { Card, CardContent } from "@/components/ui/card";
import { DocumentTable } from "@/components/wdas/document-table";
import { LoadingState, ErrorState, EmptyState } from "@/components/wdas/data-states";
import { Inbox } from "lucide-react";
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
  const [confirm, setConfirm] = useState<{ id: string; action: "approve" | "reject"; stepId?: string } | null>(null);

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
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div>
      <PageHeader title="Approval Inbox" subtitle="Documents currently awaiting your action." />
      <DelegationBanner />
      <div className="p-6">
        <Card>
          <CardContent className="p-0">
            {q.isFetching && !q.data ? <LoadingState /> :
              q.isError ? <ErrorState message="Could not load inbox." onRetry={() => q.refetch()} /> :
              !q.data?.length ? <EmptyState icon={<Inbox className="h-8 w-8" />} title="Inbox is clear" description="No documents currently need your action." /> :
              <DocumentTable
                docs={q.data}
                showActions="approver"
                onApprove={(id) => {
                  const doc = q.data?.find((d) => d.id === id);
                  setConfirm({ id, action: "approve", stepId: doc?.currentStepId });
                }}
                onReject={(id) => {
                  const doc = q.data?.find((d) => d.id === id);
                  setConfirm({ id, action: "reject", stepId: doc?.currentStepId });
                }}
              />}
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
