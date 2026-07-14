import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/wdas/page-header";
import { RoleForm, type RoleFormValue } from "@/components/wdas/create-role-form";
import { ConfirmDialog } from "@/components/wdas/confirm-dialog";
import { LoadingState, ErrorState, EmptyState } from "@/components/wdas/data-states";
import { useSession } from "@/lib/wdas/role-context";
import { P } from "@/lib/wdas/permissions";
import { wdasConfig } from "@/services/wdas-config";
import type { ApiSecurityRoleSummaryDto } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/config/roles")({
  component: RolesConfigPage,
});

function RolesConfigPage() {
  const router = useRouter();
  const { can } = useSession();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editRole, setEditRole] = useState<RoleFormValue | null>(null);
  const [deleteRole, setDeleteRole] = useState<ApiSecurityRoleSummaryDto | null>(null);

  useEffect(() => {
    if (!can(P.config.roles)) router.navigate({ to: "/dashboard" });
  }, [can, router]);

  const rolesQ = useQuery({
    queryKey: ["security-roles"],
    queryFn: () => wdasConfig.listRoles(),
    enabled: can(P.config.roles),
  });

  if (!can(P.config.roles)) return null;

  const openEdit = async (row: ApiSecurityRoleSummaryDto) => {
    try {
      const detail = await wdasConfig.getRole(row.id);
      setEditRole({
        id: detail.id,
        name: detail.name,
        description: detail.description ?? "",
        permissions: detail.permissions,
        isActive: detail.isActive,
        isSystem: detail.isSystem,
      });
    } catch (err) {
      toast.error((err as Error).message || "Could not load role.");
    }
  };

  const existingNames = (rolesQ.data ?? []).map((r) => r.name);

  return (
    <div>
      <PageHeader
        title="Roles"
        subtitle="Create roles and assign Maker and Checker rights on each configuration screen."
        actions={
          can(P.config.rolesMake) ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create role
            </Button>
          ) : null
        }
      />

      <div className="p-6">
        <Card>
          <CardContent className="p-0">
            {rolesQ.isLoading ? (
              <LoadingState />
            ) : rolesQ.isError ? (
              <ErrorState message="Could not load roles." onRetry={() => rolesQ.refetch()} />
            ) : !(rolesQ.data?.length) ? (
              <EmptyState title="No roles yet" description="Use Create role to add the first role." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[120px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rolesQ.data.map((role) => (
                    <TableRow key={role.id}>
                      <TableCell className="font-medium">
                        {role.name}
                        {role.isSystem && (
                          <Badge variant="secondary" className="ml-2">
                            System
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{role.code}</TableCell>
                      <TableCell>{role.permissionCount}</TableCell>
                      <TableCell>
                        <Badge variant={role.isActive ? "default" : "outline"}>
                          {role.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {can(P.config.rolesMake) && (
                            <Button size="sm" variant="ghost" onClick={() => openEdit(role)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {!role.isSystem && can(P.config.rolesCheck) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteRole(role)}
                            >
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create role</DialogTitle>
            <DialogDescription>Pick the screens and actions this role can use.</DialogDescription>
          </DialogHeader>
          <RoleForm
            existingNames={existingNames}
            onSaved={() => {
              qc.invalidateQueries({ queryKey: ["security-roles"] });
              setCreateOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editRole} onOpenChange={(open) => !open && setEditRole(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit role</DialogTitle>
            <DialogDescription>
              {editRole?.isSystem
                ? "System role permissions can be adjusted; the name is fixed."
                : "Update name, description, and permissions."}
            </DialogDescription>
          </DialogHeader>
          {editRole && (
            <RoleForm
              initial={editRole}
              existingNames={existingNames}
              onSaved={() => {
                qc.invalidateQueries({ queryKey: ["security-roles"] });
                setEditRole(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteRole}
        onOpenChange={(open) => !open && setDeleteRole(null)}
        title="Delete this role?"
        description={deleteRole ? `${deleteRole.name} will be permanently removed.` : ""}
        confirmLabel="Delete role"
        variant="destructive"
        onConfirm={async () => {
          if (!deleteRole) return;
          await wdasConfig.deleteRole(deleteRole.id);
          toast.success("Role deleted");
          qc.invalidateQueries({ queryKey: ["security-roles"] });
          setDeleteRole(null);
        }}
      />
    </div>
  );
}
