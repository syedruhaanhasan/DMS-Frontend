import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/wdas/page-header";
import { wdas } from "@/services/wdas";
import { useSession } from "@/lib/wdas/role-context";
import { useCanFetchDocuments } from "@/lib/wdas/use-document-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { DocumentTable } from "@/components/wdas/document-table";
import { LoadingState, ErrorState, EmptyState } from "@/components/wdas/data-states";
import { FilePlus, FileText } from "lucide-react";

export const Route = createFileRoute("/documents/")({
  component: MyDocs,
});

function MyDocs() {
  const { user } = useSession();
  const canFetch = useCanFetchDocuments();
  const q = useQuery({
    queryKey: ["docs", "owner", user.id],
    queryFn: () => wdas.listDocuments({ ownerId: user.id }),
    enabled: canFetch && !!user.id,
  });

  return (
    <div>
      <PageHeader
        title="My Documents"
        subtitle="Documents you have created."
        actions={
          <Button asChild><Link to="/documents/new"><FilePlus className="mr-2 h-4 w-4" /> New document</Link></Button>
        }
      />
      <div className="p-6">
        <Card>
          <CardContent className="p-0">
            {q.isFetching && !q.data ? <LoadingState /> :
              q.isError ? <ErrorState message="Could not load documents." onRetry={() => q.refetch()} /> :
              !q.data?.length ? <EmptyState
                icon={<FileText className="h-8 w-8" />}
                title="No documents yet"
                description="Start by creating your first document."
                action={<Button asChild><Link to="/documents/new"><FilePlus className="mr-2 h-4 w-4" /> New document</Link></Button>}
              /> :
              <DocumentTable docs={q.data} showStatus />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
