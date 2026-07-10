import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/wdas/page-header";
import { LoadingState, ErrorState, EmptyState } from "@/components/wdas/data-states";
import { ConfirmDialog } from "@/components/wdas/confirm-dialog";
import { useSession, isSuperAdmin } from "@/lib/wdas/role-context";
import { wdasConfig } from "@/services/wdas-config";
import { DEPARTMENTS, type Department, type Workflow } from "@/lib/wdas/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Workflow as WorkflowIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ActiveStatusBadge, ActiveStatusFilter, ActiveStatusSwitch, matchesActiveFilter, type ActiveFilter } from "@/components/wdas/active-status";

export const Route = createFileRoute("/config/workflows/")({
  component: WorkflowsPage,
});

function WorkflowsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { role, scopeDept, viewDept, setViewDept, hasRole } = useSession();
  const [deleteWorkflow, setDeleteWorkflow] = useState<Workflow | null>(null);
  const [statusFilter, setStatusFilter] = useState<ActiveFilter>("all");
  useEffect(() => { if (!hasRole("super_admin")) router.navigate({ to: "/dashboard" }); }, [hasRole, router]);

  const q = useQuery({
    queryKey: ["workflows", scopeDept],
    queryFn: () => wdasConfig.listWorkflows(scopeDept),
  });

  const modeLabel: Record<string, string> = { matrix: "Amount Matrix", user: "User-based", adhoc: "Ad-hoc", hybrid: "Hybrid", group: "User-based" };
  const statusVariant: Record<string, string> = {
    active: "border-success/30 bg-success/15 text-success",
    draft: "border-warning/40 bg-warning/20 text-warning-foreground",
    archived: "bg-muted text-muted-foreground",
  };

  const filteredWorkflows = (q.data ?? []).filter((w) => matchesActiveFilter(w.isActive !== false, statusFilter));

  const toggleWorkflowStatus = async (w: Workflow, isActive: boolean) => {
    try {
      await wdasConfig.setWorkflowActiveStatus(w.id, isActive);
      toast.success(isActive ? "Workflow activated" : "Workflow deactivated");
      q.refetch();
      qc.invalidateQueries({ queryKey: ["workflows"] });
    } catch (err) {
      toast.error((err as Error).message || "Could not update workflow status.");
    }
  };

  return (
    <div>
      <PageHeader
        title="Workflows"
        subtitle={hasRole("super_admin") ? "All departments' approval workflows." : `Workflows in ${scopeDept}.`}
        actions={
          <>
            {hasRole("super_admin") && (
              <div className="flex items-center gap-2">
                <ActiveStatusFilter value={statusFilter} onChange={setStatusFilter} />
                <Label className="text-xs text-muted-foreground">Department</Label>
                <Select value={viewDept ?? "all"} onValueChange={(v) => setViewDept(v as Department | "all")}>
                  <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All departments</SelectItem>
                    {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button asChild><Link to="/config/workflows/new"><Plus className="mr-1 h-4 w-4" /> New workflow</Link></Button>
          </>
        }
      />
      <div className="p-6">
        <div className="rounded-md border bg-card">
          {q.isLoading ? <LoadingState />
            : q.isError ? <ErrorState message="Could not load workflows." onRetry={() => q.refetch()} />
            : !filteredWorkflows.length ? <EmptyState icon={<WorkflowIcon className="h-8 w-8" />} title={statusFilter === "all" ? "No workflows yet" : "No workflows match this filter"} description="Create a workflow to route documents automatically." action={<Button asChild><Link to="/config/workflows/new">Create workflow</Link></Button>} />
            : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Document Type</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Approval Mode</TableHead>
                    <TableHead>Lifecycle</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWorkflows.map((w) => (
                    <TableRow key={w.id} className="hover:bg-muted/40">
                      <TableCell>
                        <Link to="/config/workflows/$id" params={{ id: w.id }} className="font-medium text-primary hover:underline">{w.name}</Link>
                        <p className="text-xs text-muted-foreground">{w.description}</p>
                      </TableCell>
                      <TableCell className="text-sm">{w.documentType ?? "—"}</TableCell>
                      <TableCell><Badge variant="outline">{w.department ?? "—"}</Badge></TableCell>
                      <TableCell><Badge variant="secondary">{modeLabel[w.mode ?? "user"]}</Badge></TableCell>
                      <TableCell><Badge className={statusVariant[w.status ?? "draft"]} variant="outline">{(w.status ?? "draft").toUpperCase()}</Badge></TableCell>
                      <TableCell><ActiveStatusBadge active={w.isActive !== false} /></TableCell>
                      <TableCell>
                        <ActiveStatusSwitch
                          id={`workflow-active-${w.id}`}
                          active={w.isActive !== false}
                          label=""
                          onChange={(isActive) => toggleWorkflowStatus(w, isActive)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">v{w.version ?? 1}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button asChild variant="ghost" size="sm"><Link to="/config/workflows/$id" params={{ id: w.id }}>Open</Link></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteWorkflow(w)} title="Delete workflow">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteWorkflow}
        onOpenChange={(open) => { if (!open) setDeleteWorkflow(null); }}
        title="Deactivate this workflow?"
        description={deleteWorkflow ? `${deleteWorkflow.name} will be set to inactive. Existing documents are not affected.` : ""}
        confirmLabel="Deactivate"
        variant="destructive"
        onConfirm={async () => {
          if (!deleteWorkflow) return;
          try {
            await wdasConfig.setWorkflowActiveStatus(deleteWorkflow.id, false);
            toast.success("Workflow deactivated");
            setDeleteWorkflow(null);
            q.refetch();
            qc.invalidateQueries({ queryKey: ["workflows"] });
          } catch (err) {
            toast.error((err as Error).message || "Could not deactivate workflow.");
          }
        }}
      />
    </div>
  );
}
