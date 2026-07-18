import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/wdas/page-header";
import { CreateUserForm } from "@/components/wdas/create-user-form";
import { EditUserSheet } from "@/components/wdas/edit-user-sheet";
import { ConfirmDialog } from "@/components/wdas/confirm-dialog";
import { LoadingState, ErrorState, EmptyState } from "@/components/wdas/data-states";
import { useSession } from "@/lib/wdas/role-context";
import { P } from "@/lib/wdas/permissions";
import { wdasConfig } from "@/services/wdas-config";
import type { User } from "@/lib/wdas/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserPlus, Users, Pencil, Trash2, Search, ShieldCheck, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { ActiveStatusBadge, ActiveStatusFilter, ActiveStatusSwitch, matchesActiveFilter, type ActiveFilter } from "@/components/wdas/active-status";

export const Route = createFileRoute("/config/users")({
  component: UserManagementPage,
});

function UserManagementPage() {
  const router = useRouter();
  const { can } = useSession();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [statusFilter, setStatusFilter] = useState<ActiveFilter>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!can(P.config.users)) router.navigate({ to: "/dashboard" });
  }, [can, router]);

  const users = useQuery({
    queryKey: ["user-management"],
    queryFn: () => wdasConfig.listUsers(),
    enabled: can(P.config.users),
  });

  if (!can(P.config.users)) return null;

  const allUsers = users.data ?? [];
  const searchTerm = search.trim().toLowerCase();
  const filteredUsers = allUsers.filter((u) =>
    matchesActiveFilter(u.isActive !== false, statusFilter) &&
    (!searchTerm || [u.name, u.username, u.adId, u.email, u.department].some((value) => value?.toLowerCase().includes(searchTerm))),
  );

  const toggleUserStatus = async (u: User, isActive: boolean) => {
    try {
      await wdasConfig.setUserActiveStatus(u.id, isActive);
      toast.success(isActive ? "User activated" : "User deactivated");
      users.refetch();
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["directory"] });
    } catch (err) {
      toast.error((err as Error).message || "Could not update user status.");
    }
  };

  return (
    <div className="min-h-full bg-[#f6f4ef] dark:bg-[#090b0f]">
      <PageHeader
        title="User Management"
        subtitle="Create accounts (Maker) and assign roles or activate users (Checker)."
        actions={
          can(P.config.usersMake) ? (
          <Button
            onClick={() => setCreateOpen(true)}
            className="group h-auto gap-3 rounded-xl border border-amber-300 bg-amber-400 px-4 py-2.5 text-zinc-950 shadow-[0_10px_28px_-14px_rgba(245,158,11,.9)] hover:bg-amber-300"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-amber-400">
              <UserPlus className="h-4 w-4" />
            </span>
            <span className="flex flex-col items-start text-left leading-tight">
              <span className="text-sm font-semibold tracking-tight">Create new user</span>
              <span className="text-[11px] font-medium text-zinc-700">Add account & assign roles</span>
            </span>
          </Button>
          ) : null
        }
      />

      <div className="space-y-6 p-6 lg:p-8">
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat icon={Users} label="Total accounts" value={allUsers.length} />
          <Stat icon={UserCheck} label="Active users" value={allUsers.filter((user) => user.isActive !== false).length} />
          <Stat icon={ShieldCheck} label="Assigned roles" value={new Set(allUsers.flatMap((user) => user.appRoles?.length ? user.appRoles : [user.appRole ?? "Maker"])).size} />
        </div>

        <Card className="overflow-hidden border-zinc-200 shadow-sm dark:border-zinc-800">
          <CardHeader className="border-b bg-white dark:bg-zinc-950">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.2em] text-amber-600">Identity directory</p>
              <CardTitle className="mt-1 text-xl">People & access</CardTitle>
              <CardDescription className="mt-1">Manage account status, roles, and organizational placement.</CardDescription>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative min-w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users…" className="bg-background pl-9" />
              </div>
              <ActiveStatusFilter value={statusFilter} onChange={setStatusFilter} />
              <Badge variant="outline" className="border-amber-400/50 bg-amber-400/10 text-amber-700">{filteredUsers.length} shown</Badge>
            </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {users.isLoading ? <LoadingState />
              : users.isError ? <ErrorState message="Could not load users." onRetry={() => users.refetch()} />
              : !filteredUsers.length ? <EmptyState title={statusFilter === "all" ? "No users yet" : "No users match this filter"} />
              : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-zinc-50/80 hover:bg-zinc-50/80 dark:bg-zinc-900/70 dark:hover:bg-zinc-900/70">
                      <TableHead>Name</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Roles</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead className="w-[120px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((u) => (
                      <TableRow key={u.id} className="group hover:bg-amber-50/50 dark:hover:bg-amber-400/5">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 border border-amber-400/30">
                              <AvatarFallback className="bg-zinc-950 text-xs font-semibold text-amber-400">
                                {u.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}
                              </AvatarFallback>
                            </Avatar>
                            <div><p className="font-medium">{u.name}</p><p className="text-xs text-muted-foreground">{u.designation ?? "Team member"}</p></div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{u.username ?? u.adId}</TableCell>
                        <TableCell className="text-sm">{u.email}</TableCell>
                        <TableCell>{u.department}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(u.appRoles?.length ? u.appRoles : [u.appRole ?? "Maker"]).map((r) => (
                              <Badge key={r} variant="outline">{r}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell><ActiveStatusBadge active={u.isActive !== false} /></TableCell>
                        <TableCell>
                          {can(P.config.usersCheck) ? (
                            <ActiveStatusSwitch
                              id={`user-active-${u.id}`}
                              active={u.isActive !== false}
                              label=""
                              onChange={(isActive) => toggleUserStatus(u, isActive)}
                            />
                          ) : (
                            <ActiveStatusBadge active={u.isActive !== false} />
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {can(P.config.usersCheck) && (
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditUser(u)} title="Edit user">
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {can(P.config.usersCheck) && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteUser(u)} title="Delete user">
                                <Trash2 className="h-4 w-4" />
                              </Button>
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Create new user
            </DialogTitle>
            <DialogDescription>
              Add a normal or Active Directory user account with an application role.
            </DialogDescription>
          </DialogHeader>
          <CreateUserForm
            showCancel
            onCancel={() => setCreateOpen(false)}
            onCreated={() => {
              users.refetch();
              qc.invalidateQueries({ queryKey: ["directory"] });
              qc.invalidateQueries({ queryKey: ["users"] });
              setCreateOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>

      <EditUserSheet
        user={editUser}
        open={!!editUser}
        onOpenChange={(open) => { if (!open) setEditUser(null); }}
        onSaved={() => {
          users.refetch();
          qc.invalidateQueries({ queryKey: ["users"] });
          qc.invalidateQueries({ queryKey: ["directory"] });
        }}
      />

      <ConfirmDialog
        open={!!deleteUser}
        onOpenChange={(open) => { if (!open) setDeleteUser(null); }}
        title="Deactivate this user?"
        description={deleteUser ? `${deleteUser.name} will be deactivated and cannot sign in.` : ""}
        confirmLabel="Deactivate"
        variant="destructive"
        onConfirm={async () => {
          if (!deleteUser) return;
          await wdasConfig.deleteUser(deleteUser.id);
          toast.success("User deactivated", { description: deleteUser.name });
          setDeleteUser(null);
          users.refetch();
          qc.invalidateQueries({ queryKey: ["users"] });
          qc.invalidateQueries({ queryKey: ["directory"] });
        }}
      />
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <Card className="border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <CardContent className="flex items-center justify-between p-5">
        <div><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div>
        <span className="rounded-lg bg-amber-400/15 p-2.5 text-amber-600"><Icon className="h-5 w-5" /></span>
      </CardContent>
    </Card>
  );
}
