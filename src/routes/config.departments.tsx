import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/wdas/page-header";
import { CreateDepartmentForm } from "@/components/wdas/create-department-form";
import { ConfirmDialog } from "@/components/wdas/confirm-dialog";
import { LoadingState, ErrorState, EmptyState } from "@/components/wdas/data-states";
import { useSession } from "@/lib/wdas/role-context";
import { P } from "@/lib/wdas/permissions";
import { wdasConfig } from "@/services/wdas-config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ActiveStatusBadge, ActiveStatusFilter, ActiveStatusSwitch, matchesActiveFilter, type ActiveFilter } from "@/components/wdas/active-status";

type DeptRow = { id: string; name: string; code: string; parentDepartmentId: string | null; isActive: boolean };

export const Route = createFileRoute("/config/departments")({
  component: DepartmentManagementPage,
});

function DepartmentManagementPage() {
  const router = useRouter();
  const { can } = useSession();
  const qc = useQueryClient();
  const [editDept, setEditDept] = useState<DeptRow | null>(null);
  const [deleteDept, setDeleteDept] = useState<DeptRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ActiveFilter>("all");

  useEffect(() => {
    if (!can(P.config.departments)) router.navigate({ to: "/dashboard" });
  }, [can, router]);

  const departments = useQuery({
    queryKey: ["departments"],
    queryFn: () => wdasConfig.listDepartments(),
    enabled: can(P.config.departments),
  });

  const filteredDepartments = (departments.data ?? []).filter((d) => matchesActiveFilter(d.isActive, statusFilter));

  const toggleDepartmentStatus = async (d: DeptRow, isActive: boolean) => {
    try {
      await wdasConfig.updateDepartment(d.id, { isActive });
      toast.success(isActive ? "Department activated" : "Department deactivated");
      departments.refetch();
      qc.invalidateQueries({ queryKey: ["departments"] });
    } catch (err) {
      toast.error((err as Error).message || "Could not update department status.");
    }
  };

  if (!can(P.config.departments)) return null;

  const openEdit = (d: DeptRow) => {
    setEditDept(d);
    setEditName(d.name);
    setEditCode(d.code);
    setEditActive(d.isActive);
  };

  const saveEdit = async () => {
    if (!editDept) return;
    setSaving(true);
    try {
      await wdasConfig.updateDepartment(editDept.id, { name: editName.trim(), code: editCode.trim(), isActive: editActive });
      toast.success("Department updated");
      setEditDept(null);
      departments.refetch();
      qc.invalidateQueries({ queryKey: ["departments"] });
    } catch (err) {
      toast.error((err as Error).message || "Could not update department.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full bg-[#f6f4ef] dark:bg-[#090b0f]">
      <PageHeader
        title="Department Management"
        subtitle="Create and manage departments. Only Super Admin can access this page."
      />

      <div className="space-y-6 p-6 lg:p-8">
        {can(P.config.departmentsMake) && (
        <Card className="border-amber-400/30 bg-white shadow-sm dark:bg-zinc-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5 text-amber-600" />
              Create department
            </CardTitle>
            <CardDescription>
              Add a new department. It will appear in user assignment and workflow configuration.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateDepartmentForm onCreated={() => departments.refetch()} />
          </CardContent>
        </Card>
        )}

        <Card className="overflow-hidden border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="h-5 w-5" />
                All departments
              </CardTitle>
              <CardDescription>Departments currently registered in VeriFlow.</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <ActiveStatusFilter value={statusFilter} onChange={setStatusFilter} />
              <Badge variant="secondary">{filteredDepartments.length} departments</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {departments.isLoading ? <LoadingState />
              : departments.isError ? <ErrorState message="Could not load departments." onRetry={() => departments.refetch()} />
              : !filteredDepartments.length ? <EmptyState title={statusFilter === "all" ? "No departments yet" : "No departments match this filter"} />
              : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Prefix</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDepartments.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium">{d.name}</TableCell>
                        <TableCell><Badge variant="outline" className="font-mono">{d.code}</Badge></TableCell>
                        <TableCell><ActiveStatusBadge active={d.isActive} /></TableCell>
                        <TableCell>
                          {can(P.config.departmentsCheck) ? (
                            <ActiveStatusSwitch
                              id={`dept-active-${d.id}`}
                              active={d.isActive}
                              label=""
                              onChange={(isActive) => toggleDepartmentStatus(d, isActive)}
                            />
                          ) : (
                            <ActiveStatusBadge active={d.isActive} />
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {can(P.config.departmentsMake) && (
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(d)}><Pencil className="h-4 w-4" /></Button>
                            )}
                            {can(P.config.departmentsCheck) && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteDept(d)}><Trash2 className="h-4 w-4" /></Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
          </CardContent>
        </Card>
      </div>

      <Sheet open={!!editDept} onOpenChange={(open) => { if (!open) setEditDept(null); }}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Edit department</SheetTitle>
            <SheetDescription>Update department details.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} disabled={saving} />
            </div>
            <div className="space-y-2">
              <Label>Code</Label>
              <Input value={editCode} onChange={(e) => setEditCode(e.target.value)} disabled={saving} className="font-mono uppercase" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={editActive} onCheckedChange={(c) => setEditActive(c === true)} disabled={saving} />
              Active
            </label>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setEditDept(null)} disabled={saving}>Cancel</Button>
            <Button onClick={saveEdit} disabled={saving || !editName.trim() || !editCode.trim()}>{saving ? "Savingâ€¦" : "Save"}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!deleteDept}
        onOpenChange={(open) => { if (!open) setDeleteDept(null); }}
        title="Deactivate this department?"
        description={deleteDept ? `${deleteDept.name} will be set to inactive.` : ""}
        confirmLabel="Deactivate"
        variant="destructive"
        onConfirm={async () => {
          if (!deleteDept) return;
          await wdasConfig.deleteDepartment(deleteDept.id);
          toast.success("Department deactivated");
          setDeleteDept(null);
          departments.refetch();
          qc.invalidateQueries({ queryKey: ["departments"] });
        }}
      />
    </div>
  );
}
