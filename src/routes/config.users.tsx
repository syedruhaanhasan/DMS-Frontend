import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/wdas/page-header";
import { CreateUserForm } from "@/components/wdas/create-user-form";
import { EditUserRolesSheet } from "@/components/wdas/edit-user-roles-sheet";
import { ConfirmDialog } from "@/components/wdas/confirm-dialog";
import { LoadingState, ErrorState, EmptyState } from "@/components/wdas/data-states";
import { useSession } from "@/lib/wdas/role-context";
import { P } from "@/lib/wdas/permissions";
import { wdasConfig } from "@/services/wdas-config";
import type { User } from "@/lib/wdas/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserPlus, Users, Pencil, Trash2 } from "lucide-react";
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

  useEffect(() => {
    if (!can(P.config.users)) router.navigate({ to: "/dashboard" });
  }, [can, router]);

  const users = useQuery({
    queryKey: ["user-management"],
    queryFn: () => wdasConfig.listUsers(),
    enabled: can(P.config.users),
  });

  if (!can(P.config.users)) return null;

  const filteredUsers = (users.data ?? []).filter((u) => matchesActiveFilter(u.isActive !== false, statusFilter));

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
    <div>
      <PageHeader
        title="User Management"
        subtitle="Create accounts (Maker) and assign roles or activate users (Checker)."
        actions={
          can(P.config.usersMake) ? (
          <Button
            onClick={() => setCreateOpen(true)}
            className="group relative h-auto gap-3 overflow-hidden rounded-2xl border-0 bg-gradient-to-r from-primary via-indigo-500 to-cyan-500 px-4 py-2.5 text-white shadow-[0_12px_32px_-16px_rgba(37,99,235,0.75)] transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_16px_40px_-14px_rgba(37,99,235,0.85)] active:scale-[0.98]"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/20 ring-1 ring-white/25 transition-colors group-hover:bg-white/30">
              <UserPlus className="h-4 w-4" />
            </span>
            <span className="relative flex flex-col items-start text-left leading-tight">
              <span className="text-sm font-semibold tracking-tight">Create new user</span>
              <span className="text-[11px] font-medium text-white/75">Add account & assign roles</span>
            </span>
          </Button>
          ) : null
        }
      />

      <div className="space-y-6 p-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5" />
                All users
              </CardTitle>
              <CardDescription>Users currently registered in WDAS.</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <ActiveStatusFilter value={statusFilter} onChange={setStatusFilter} />
              <Badge variant="secondary">{filteredUsers.length} users</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {users.isLoading ? <LoadingState />
              : users.isError ? <ErrorState message="Could not load users." onRetry={() => users.refetch()} />
              : !filteredUsers.length ? <EmptyState title={statusFilter === "all" ? "No users yet" : "No users match this filter"} />
              : (
                <Table>
                  <TableHeader>
                    <TableRow>
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
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.name}</TableCell>
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
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditUser(u)} title="Edit roles">
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

      <EditUserRolesSheet
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
