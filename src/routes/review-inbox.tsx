import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/wdas/page-header";
import { wdas } from "@/services/wdas";
import { useSession } from "@/lib/wdas/role-context";
import { Card, CardContent } from "@/components/ui/card";
import { DocumentTable } from "@/components/wdas/document-table";
import { LoadingState, ErrorState, EmptyState } from "@/components/wdas/data-states";
import { Eye } from "lucide-react";
import { useCanFetchDocuments } from "@/lib/wdas/use-document-query";

export const Route = createFileRoute("/review-inbox")({
  component: ReviewInboxPage,
});

function ReviewInboxPage() {
  const { user } = useSession();
  const canFetch = useCanFetchDocuments();
  const reviewQ = useQuery({
    queryKey: ["docs", "review", user.id],
    queryFn: () => wdas.listReviewDocuments(),
    enabled: canFetch && !!user.id,
  });

  const reviewDocs = reviewQ.data ?? [];

  return (
    <div className="min-h-full bg-muted/20">
      <PageHeader
        title="Reviewer Inbox"
        subtitle="Documents waiting for your review before they can continue in the workflow."
      />
      <div className="space-y-4 p-6">
        <Card className="overflow-hidden border-info/30 shadow-sm">
          <div className="flex flex-col gap-1 border-b border-info/20 bg-info/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Eye className="h-4 w-4 text-info" />
                For your review
              </h2>
              <p className="text-xs text-muted-foreground">
                Complete your review so the document can return to the creator or approver.
              </p>
            </div>
            <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-info/15 px-2 text-xs font-semibold text-info">
              {reviewDocs.length}
            </span>
          </div>
          <CardContent className="p-0">
            {reviewQ.isFetching && !reviewQ.data ? (
              <LoadingState />
            ) : reviewQ.isError ? (
              <ErrorState
                message="Could not load review documents."
                onRetry={() => reviewQ.refetch()}
              />
            ) : !reviewDocs.length ? (
              <EmptyState
                icon={<Eye className="h-8 w-8" />}
                title="No documents to review"
                description="When someone adds you as a reviewer, those documents will appear here."
              />
            ) : (
              <DocumentTable docs={reviewDocs} showStatus />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
