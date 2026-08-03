import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { wdas } from "@/services/wdas";
import { useSession } from "@/lib/wdas/role-context";
import { useCanFetchDocuments } from "@/lib/wdas/use-document-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { DocumentTable } from "@/components/wdas/document-table";
import { LoadingState, ErrorState, EmptyState } from "@/components/wdas/data-states";
import { useMemo, useState } from "react";
import { Eye, FilePlus, FileText, Layers3 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DocStatus } from "@/lib/wdas/types";

export const Route = createFileRoute("/documents/")({
  component: MyDocs,
});

type DocumentTab = "drafts" | "inApproval" | "approved" | "rejected" | "returned" | "forReview";

const STATUS_TABS: { id: Exclude<DocumentTab, "forReview">; label: string; statuses: DocStatus[] }[] = [
  { id: "drafts", label: "Drafts", statuses: ["draft"] },
  { id: "inApproval", label: "In Approval", statuses: ["pending", "ready_to_finalize", "pending_reviewer", "pending_creator_send"] },
  { id: "approved", label: "Approved", statuses: ["approved"] },
  { id: "rejected", label: "Rejected", statuses: ["rejected"] },
  { id: "returned", label: "Returned", statuses: ["returned"] },
];

function MyDocs() {
  const [activeTab, setActiveTab] = useState<DocumentTab>("drafts");
  const { user } = useSession();
  const canFetch = useCanFetchDocuments();
  const q = useQuery({
    queryKey: ["docs", "owner", user.id],
    queryFn: () => wdas.listDocuments({ ownerId: user.id }),
    enabled: canFetch && !!user.id,
  });
  // Documents shared with the current user for review (informational, no approval authority).
  const reviewQ = useQuery({
    queryKey: ["docs", "review", user.id],
    queryFn: () => wdas.listReviewDocuments(),
    enabled: canFetch && !!user.id,
  });

  const isReviewTab = activeTab === "forReview";

  const counts = useMemo(() => {
    const statusCounts = Object.fromEntries(
      STATUS_TABS.map((tab) => [
        tab.id,
        (q.data ?? []).filter((doc) => tab.statuses.includes(doc.status)).length,
      ]),
    ) as Record<DocumentTab, number>;
    statusCounts.forReview = (reviewQ.data ?? []).length;
    return statusCounts;
  }, [q.data, reviewQ.data]);

  const filtered = useMemo(() => {
    if (isReviewTab) return reviewQ.data ?? [];
    const tab = STATUS_TABS.find((item) => item.id === activeTab)!;
    return (q.data ?? []).filter((doc) => tab.statuses.includes(doc.status));
  }, [activeTab, isReviewTab, q.data, reviewQ.data]);

  const activeLabel = isReviewTab
    ? "For Review"
    : STATUS_TABS.find((tab) => tab.id === activeTab)!.label;

  const activeQuery = isReviewTab ? reviewQ : q;

  return (
    <div className="min-h-full bg-background">
      <div className="relative overflow-hidden border-b border-slate-800 bg-slate-950 px-6 py-7 text-white sm:px-8">
        <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="relative mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-5">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-400">
              <Layers3 className="h-3.5 w-3.5" />
              Personal workspace
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Documents</h1>
            <p className="mt-1.5 text-sm text-slate-400">
              Create, track, and manage your document workflow.
            </p>
          </div>
          <Button
            asChild
            className="border border-amber-300 bg-amber-400 text-slate-950 shadow-lg shadow-amber-950/20 hover:bg-amber-300"
          >
            <Link to="/documents/new">
              <FilePlus className="mr-2 h-4 w-4" /> New document
            </Link>
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-5 p-6 sm:p-8">
        <nav
          className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1.5 shadow-sm"
          aria-label="Document status"
        >
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex min-w-fit flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950"
                  : "text-muted-foreground hover:bg-amber-50 hover:text-foreground dark:hover:bg-amber-400/10",
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "min-w-6 rounded-full px-1.5 py-0.5 text-center text-[11px] font-semibold",
                  activeTab === tab.id
                    ? "bg-amber-400 text-slate-950"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {counts[tab.id]}
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setActiveTab("forReview")}
            className={cn(
              "flex min-w-fit flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
              isReviewTab
                ? "bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950"
                : "text-muted-foreground hover:bg-amber-50 hover:text-foreground dark:hover:bg-amber-400/10",
            )}
          >
            <Eye className="h-3.5 w-3.5" />
            For Review
            <span
              className={cn(
                "min-w-6 rounded-full px-1.5 py-0.5 text-center text-[11px] font-semibold",
                isReviewTab ? "bg-amber-400 text-slate-950" : "bg-muted text-muted-foreground",
              )}
            >
              {counts.forReview}
            </span>
          </button>
        </nav>

        <Card className="overflow-hidden border-border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
            <div>
              <h2 className="font-semibold text-foreground">{activeLabel}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {counts[activeTab]} {counts[activeTab] === 1 ? "document" : "documents"}
              </p>
            </div>
            <span className="h-1.5 w-12 rounded-full bg-amber-400" />
          </div>
          <CardContent className="p-0">
            {activeQuery.isFetching && !activeQuery.data ? (
              <LoadingState />
            ) : activeQuery.isError ? (
              <ErrorState message="Could not load documents." onRetry={() => activeQuery.refetch()} />
            ) : isReviewTab ? (
              filtered.length ? (
                <DocumentTable docs={filtered} showStatus />
              ) : (
                <EmptyState
                  icon={<Eye className="h-8 w-8" />}
                  title="Nothing to review"
                  description="Documents shared with you for review will appear here."
                />
              )
            ) : !q.data?.length ? (
              <EmptyState
                icon={<FileText className="h-8 w-8" />}
                title="No documents yet"
                description="Start by creating your first document."
                action={
                  <Button asChild className="bg-amber-400 text-slate-950 hover:bg-amber-300">
                    <Link to="/documents/new">
                      <FilePlus className="mr-2 h-4 w-4" /> New document
                    </Link>
                  </Button>
                }
              />
            ) : !filtered.length ? (
              <EmptyState
                icon={<FileText className="h-8 w-8" />}
                title={`No ${activeLabel.toLowerCase()} documents`}
                description="Documents in this stage will appear here."
              />
            ) : (
              <DocumentTable docs={filtered} showStatus showReadStatus />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
