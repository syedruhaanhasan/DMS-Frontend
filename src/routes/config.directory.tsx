import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/wdas/page-header";
import { LoadingState, ErrorState, EmptyState } from "@/components/wdas/data-states";
import { useSession, isSuperAdmin } from "@/lib/wdas/role-context";
import { P } from "@/lib/wdas/permissions";
import { wdasConfig } from "@/services/wdas-config";
import { DEPARTMENTS, APP_ROLES, type AppRole, type Department, type User } from "@/lib/wdas/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, RefreshCw, ShieldAlert, Users, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/wdas/confirm-dialog";
import { CreateUserForm } from "@/components/wdas/create-user-form";
import { EditUserRolesSheet } from "@/components/wdas/edit-user-roles-sheet";

export const Route = createFileRoute("/config/directory")({
  component: DirectoryPage,
});

function DirectoryPage() {
  const router = useRouter();
  const { role, scopeDept, setViewDept, viewDept, can } = useSession();
  const qc = useQueryClient();

  useEffect(() => {
    if (!can(P.config.ad)) router.navigate({ to: "/dashboard" });
  }, [can, router]);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "disabled">("all");
  const [syncing, setSyncing] = useState(false);
  const [selected, setSelected] = useState<User | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const dept: Department | "all" = scopeDept;

  const users = useQuery({
    queryKey: ["directory", dept, q, statusFilter],
    queryFn: () => wdasConfig.listUsers({
      department: dept,
      query: q || undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
    }),
  });

  const doSync = async () => {
    setSyncing(true);
    try {
      const res = await wdasConfig.syncDirectory();
      toast.success("Directory sync complete", { description: `${res.updated} updated, ${res.disabled} disabled.` });
      qc.invalidateQueries({ queryKey: ["directory"] });
    } finally { setSyncing(false); }
  };

  return (
    <div>
      <PageHeader
        title="Directory (AD Users)"
        subtitle={role === "super_admin" ? "All departments â€” synced from Active Directory." : `Users in ${scopeDept} â€” synced from Active Directory.`}
        actions={
          <>
            {role === "super_admin" && (
              <div className="flex items-center gap-2">
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
            <Button onClick={doSync} disabled={syncing || !can(P.config.adCheck)}>
              <RefreshCw className={syncing ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
              {syncing ? "Syncing…" : "Sync now"}
            </Button>
            {can(P.config.usersMake) && (
              <Button onClick={() => setCreateOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Create user
              </Button>
            )}
          </>
        }
      />
      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search name, email, AD IDâ€¦" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="secondary" className="ml-auto"><Users className="mr-1 h-3 w-3" /> {users.data?.length ?? 0} users</Badge>
        </div>

        <div className="rounded-md border bg-card">
          {users.isLoading ? <LoadingState />
            : users.isError ? <ErrorState message="Could not load directory." onRetry={() => users.refetch()} />
            : !users.data?.length ? <EmptyState title="No users match your filters" />
            : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>AD ID</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Manager</TableHead>
                    <TableHead>App Role</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.data.map((u) => {
                    const mgr = users.data.find((x) => x.id === u.managerId);
                    const st = u.status ?? "active";
                    return (
                      <TableRow key={u.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setSelected(u)}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              <AvatarFallback className="bg-primary/10 text-[10px] text-primary">
                                {u.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{u.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{u.adId}</TableCell>
                        <TableCell className="text-xs">{u.email}</TableCell>
                        <TableCell>{u.department}</TableCell>
                        <TableCell className="text-xs">{u.designation}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{mgr?.name ?? "â€”"}</TableCell>
                        <TableCell><Badge variant="outline">{u.appRole ?? "Maker"}</Badge></TableCell>
                        <TableCell>
                          {st === "active"
                            ? <Badge className="border-success/30 bg-success/15 text-success" variant="outline">Active</Badge>
                            : (
                              <div className="flex items-center gap-2">
                                <Badge className="border-destructive/30 bg-destructive/15 text-destructive" variant="outline"><ShieldAlert className="mr-1 h-3 w-3" /> Disabled</Badge>
                                <Link to="/settings/delegation" className="text-xs text-primary hover:underline">Set delegation</Link>
                              </div>
                            )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )
          }
        </div>
      </div>

      <EditUserRolesSheet
        user={selected}
        open={!!selected}
        onOpenChange={(o) => { if (!o) setSelected(null); }}
        onSaved={() => qc.invalidateQueries({ queryKey: ["directory"] })}
      />
      <CreateUserPanel
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ["directory"] });
          qc.invalidateQueries({ queryKey: ["users"] });
        }}
      />
    </div>
  );
}

function CreateUserPanel({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Create user</SheetTitle>
          <SheetDescription>
            Add a local WDAS account. The user can sign in immediately with the username and password you set.
          </SheetDescription>
        </SheetHeader>
        <div className="py-4">
          <CreateUserForm
            showCancel
            onCancel={() => onOpenChange(false)}
            onCreated={() => {
              onCreated();
              onOpenChange(false);
            }}
          />
        </div>
        <SheetFooter />
      </SheetContent>
    </Sheet>
  );
}
