import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/wdas/page-header";
import { ConfirmDialog } from "@/components/wdas/confirm-dialog";
import { LoadingState, ErrorState, EmptyState } from "@/components/wdas/data-states";
import { useSession } from "@/lib/wdas/role-context";
import { P } from "@/lib/wdas/permissions";
import { wdasConfig, type UserTypeItem } from "@/services/wdas-config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { IdCard, Search, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ActiveStatusBadge, ActiveStatusFilter, ActiveStatusSwitch, matchesActiveFilter, type ActiveFilter } from "@/components/wdas/active-status";

export const Route = createFileRoute("/config/user-types")({
  component: UserTypesPage,
});

function UserTypesPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { can } = useSession();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ActiveFilter>("all");

  const [createName, setCreateName] = useState("");
  const [createCode, setCreateCode] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const [editType, setEditType] = useState<UserTypeItem | null>(null);
  const [deleteType, setDeleteType] = useState<UserTypeItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!can(P.config.users)) router.navigate({ to: "/dashboard" });
  }, [can, router]);

  const userTypes = useQuery({
    queryKey: ["user-types"],
    queryFn: () => wdasConfig.listUserTypes(),
    enabled: can(P.config.users),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = userTypes.data ?? [];
    const byStatus = rows.filter((t) => matchesActiveFilter(t.isActive, statusFilter));
    if (!q) return byStatus;
    return byStatus.filter((t) =>
      t.name.toLowerCase().includes(q) ||
      t.code.toLowerCase().includes(q) ||
      (t.description?.toLowerCase().includes(q) ?? false),
    );
  }, [userTypes.data, search, statusFilter]);

  if (!can(P.config.users)) return null;

  const refresh = () => {
    userTypes.refetch();
    qc.invalidateQueries({ queryKey: ["user-types"] });
  };

  const createUserType = async () => {
    if (!createName.trim() || createCode.trim().length < 2) return;
    setCreating(true);
    try {
      await wdasConfig.createUserType({
        name: createName.trim(),
        code: createCode.trim(),
        description: createDescription.trim() || undefined,
      });
      toast.success("User type created");
      setCreateName("");
      setCreateCode("");
      setCreateDescription("");
      refresh();
    } catch (err) {
      toast.error((err as Error).message || "Could not create user type.");
    } finally {
      setCreating(false);
    }
  };

  const toggleStatus = async (t: UserTypeItem, isActive: boolean) => {
    try {
      await wdasConfig.updateUserType(t.id, { isActive });
      toast.success(isActive ? "User type activated" : "User type deactivated");
      refresh();
    } catch (err) {
      toast.error((err as Error).message || "Could not update user type status.");
    }
  };

  const openEdit = (t: UserTypeItem) => {
    setEditType(t);
    setEditName(t.name);
    setEditDescription(t.description ?? "");
    setEditActive(t.isActive);
  };

  const saveEdit = async () => {
    if (!editType) return;
    setSaving(true);
    try {
      await wdasConfig.updateUserType(editType.id, {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
        isActive: editActive,
      });
      toast.success("User type updated");
      setEditType(null);
      refresh();
    } catch (err) {
      toast.error((err as Error).message || "Could not update user type.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full bg-[#f6f4ef] dark:bg-[#090b0f]">
      <PageHeader
        title="User Types"
        subtitle="Manage user classifications (e.g. Permanent, Contractor, Intern) that can be assigned to users."
      />

      <div className="space-y-6 p-6 lg:p-8">
        {can(P.config.usersMake) && (
          <Card className="border-amber-400/30 bg-white shadow-sm dark:bg-zinc-950">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <IdCard className="h-5 w-5 text-amber-600" />
                Create user type
              </CardTitle>
              <CardDescription>
                Add a reusable user type. It can be selected when creating or editing a user.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="e.g. Permanent" disabled={creating} />
                </div>
                <div className="space-y-2">
                  <Label>Code</Label>
                  <Input value={createCode} onChange={(e) => setCreateCode(e.target.value)} placeholder="e.g. Permanent" disabled={creating} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Description (optional)</Label>
                  <Input value={createDescription} onChange={(e) => setCreateDescription(e.target.value)} placeholder="Short description" disabled={creating} />
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <Button onClick={createUserType} disabled={creating || !createName.trim() || createCode.trim().length < 2}>
                  {creating ? "Creating…" : "Create user type"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="overflow-hidden border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <CardHeader className="flex flex-col gap-4 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <IdCard className="h-5 w-5" />
                All user types
              </CardTitle>
              <CardDescription>Search and browse registered user types.</CardDescription>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <ActiveStatusFilter value={statusFilter} onChange={setStatusFilter} />
              <div className="relative w-full sm:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or code…"
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {userTypes.isFetching && !userTypes.data ? <LoadingState />
              : userTypes.isError ? <ErrorState message="Could not load user types." onRetry={() => userTypes.refetch()} />
              : !filtered.length ? (
                <EmptyState
                  title={search.trim() ? "No matching user types" : "No user types yet"}
                  description={search.trim() ? "Try a different search term." : "Create your first user type above."}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.name}</TableCell>
                        <TableCell><Badge variant="outline" className="font-mono">{t.code}</Badge></TableCell>
                        <TableCell className="max-w-xs truncate text-sm text-muted-foreground">{t.description ?? "—"}</TableCell>
                        <TableCell><ActiveStatusBadge active={t.isActive} /></TableCell>
                        <TableCell>
                          {can(P.config.usersCheck) ? (
                            <ActiveStatusSwitch
                              id={`usertype-active-${t.id}`}
                              active={t.isActive}
                              label=""
                              onChange={(isActive) => toggleStatus(t, isActive)}
                            />
                          ) : (
                            <ActiveStatusBadge active={t.isActive} />
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {can(P.config.usersMake) && (
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                            )}
                            {can(P.config.usersCheck) && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteType(t)}><Trash2 className="h-4 w-4" /></Button>
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

      <Sheet open={!!editType} onOpenChange={(open) => { if (!open) setEditType(null); }}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Edit user type</SheetTitle>
            <SheetDescription>{editType?.code}</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} disabled={saving} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} disabled={saving} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={editActive} onCheckedChange={(c) => setEditActive(c === true)} disabled={saving} />
              Active
            </label>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setEditType(null)} disabled={saving}>Cancel</Button>
            <Button onClick={saveEdit} disabled={saving || !editName.trim()}>{saving ? "Saving…" : "Save"}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!deleteType}
        onOpenChange={(open) => { if (!open) setDeleteType(null); }}
        title="Deactivate this user type?"
        description={deleteType ? `${deleteType.name} will be set to inactive.` : ""}
        confirmLabel="Deactivate"
        variant="destructive"
        onConfirm={async () => {
          if (!deleteType) return;
          await wdasConfig.deleteUserType(deleteType.id);
          toast.success("User type deactivated");
          setDeleteType(null);
          refresh();
        }}
      />
    </div>
  );
}
