import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/wdas/page-header";
import { CreateUserForm } from "@/components/wdas/create-user-form";
import { EditUserRolesSheet } from "@/components/wdas/edit-user-roles-sheet";
import { ConfirmDialog } from "@/components/wdas/confirm-dialog";
import { LoadingState, ErrorState, EmptyState } from "@/components/wdas/data-states";
import { useSession } from "@/lib/wdas/role-context";
import { wdasConfig } from "@/services/wdas-config";
import type { User } from "@/lib/wdas/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { UserPlus, Users, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/config/users")({
  component: UserManagementPage,
});

function UserManagementPage() {
  const router = useRouter();
  const { hasRole } = useSession();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);

  useEffect(() => {
    if (!hasRole("super_admin")) router.navigate({ to: "/dashboard" });
  }, [hasRole, router]);

  const users = useQuery({
    queryKey: ["user-management"],
    queryFn: () => wdasConfig.listUsers(),
    enabled: hasRole("super_admin"),
  });

  if (!hasRole("super_admin")) return null;

  return (
    <div>
      <PageHeader
        title="User Management"
        subtitle="Create local or Active Directory user accounts and assign application roles. Only Super Admin can access this page."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Create new user
          </Button>
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
            <Badge variant="secondary">{users.data?.length ?? 0} users</Badge>
          </CardHeader>
          <CardContent className="p-0">
            {users.isLoading ? <LoadingState />
              : users.isError ? <ErrorState message="Could not load users." onRetry={() => users.refetch()} />
              : !users.data?.length ? <EmptyState title="No users yet" />
              : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Roles</TableHead>
                      <TableHead className="w-[120px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.data.map((u) => (
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
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditUser(u)} title="Edit roles">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteUser(u)} title="Delete user">
                              <Trash2 className="h-4 w-4" />
                            </Button>
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

      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Create new user
            </SheetTitle>
            <SheetDescription>
              Add a normal or Active Directory user account with an application role.
            </SheetDescription>
          </SheetHeader>
          <div className="py-4">
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
          </div>
          <SheetFooter />
        </SheetContent>
      </Sheet>

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
        title="Delete this user?"
        description={deleteUser ? `${deleteUser.name} will be disabled and cannot sign in.` : ""}
        confirmLabel="Delete user"
        variant="destructive"
        onConfirm={async () => {
          if (!deleteUser) return;
          await wdasConfig.deleteUser(deleteUser.id);
          toast.success("User deleted", { description: deleteUser.name });
          setDeleteUser(null);
          users.refetch();
          qc.invalidateQueries({ queryKey: ["users"] });
          qc.invalidateQueries({ queryKey: ["directory"] });
        }}
      />
    </div>
  );
}
