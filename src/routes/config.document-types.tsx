import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/wdas/page-header";
import { CreateDocumentTypeForm } from "@/components/wdas/create-document-type-form";
import { ConfirmDialog } from "@/components/wdas/confirm-dialog";
import { LoadingState, ErrorState, EmptyState } from "@/components/wdas/data-states";
import { useSession, isSuperAdmin } from "@/lib/wdas/role-context";
import { P } from "@/lib/wdas/permissions";
import { wdasConfig } from "@/services/wdas-config";
import type { DocumentTypeCatalogItem } from "@/lib/wdas/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileType, Search, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ActiveStatusBadge, ActiveStatusFilter, ActiveStatusSwitch, matchesActiveFilter, type ActiveFilter } from "@/components/wdas/active-status";

export const Route = createFileRoute("/config/document-types")({
  component: DocumentTypesPage,
});

function DocumentTypesPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { role, can } = useSession();
  const [search, setSearch] = useState("");
  const [editType, setEditType] = useState<DocumentTypeCatalogItem | null>(null);
  const [deleteType, setDeleteType] = useState<DocumentTypeCatalogItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ActiveFilter>("all");

  useEffect(() => {
    if (!can(P.config.documentTypes)) router.navigate({ to: "/dashboard" });
  }, [can, router]);

  const documentTypes = useQuery({
    queryKey: ["document-types"],
    queryFn: () => wdasConfig.listDocumentTypes(),
    enabled: can(P.config.documentTypes),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = documentTypes.data ?? [];
    const byStatus = rows.filter((t) => matchesActiveFilter(t.isActive, statusFilter));
    if (!q) return byStatus;
    return byStatus.filter((t) =>
      t.name.toLowerCase().includes(q) ||
      t.code.toLowerCase().includes(q) ||
      (t.description?.toLowerCase().includes(q) ?? false),
    );
  }, [documentTypes.data, search, statusFilter]);

  const toggleDocumentTypeStatus = async (t: DocumentTypeCatalogItem, isActive: boolean) => {
    try {
      await wdasConfig.updateDocumentType(t.id, { isActive });
      toast.success(isActive ? "Document type activated" : "Document type deactivated");
      documentTypes.refetch();
      qc.invalidateQueries({ queryKey: ["document-types"] });
    } catch (err) {
      toast.error((err as Error).message || "Could not update document type status.");
    }
  };

  if (!can(P.config.documentTypes)) return null;

  const openEdit = (t: DocumentTypeCatalogItem) => {
    setEditType(t);
    setEditName(t.name);
    setEditDescription(t.description ?? "");
    setEditActive(t.isActive);
  };

  const saveEdit = async () => {
    if (!editType) return;
    setSaving(true);
    try {
      await wdasConfig.updateDocumentType(editType.id, {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
        isActive: editActive,
      });
      toast.success("Document type updated");
      setEditType(null);
      documentTypes.refetch();
      qc.invalidateQueries({ queryKey: ["document-types"] });
    } catch (err) {
      toast.error((err as Error).message || "Could not update document type.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full bg-[#f6f4ef] dark:bg-[#090b0f]">
      <PageHeader
        title="Document Types"
        subtitle="Manage document types used when creating workflows. Only Super Admin can add, update, or delete."
      />

      <div className="space-y-6 p-6 lg:p-8">
        {can(P.config.documentTypesMake) && (
        <Card className="border-amber-400/30 bg-white shadow-sm dark:bg-zinc-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileType className="h-5 w-5 text-amber-600" />
              Create document type
            </CardTitle>
            <CardDescription>
              Add a reusable document type. It can be selected when configuring workflows.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateDocumentTypeForm onCreated={() => documentTypes.refetch()} />
          </CardContent>
        </Card>
        )}

        <Card className="overflow-hidden border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <CardHeader className="flex flex-col gap-4 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileType className="h-5 w-5" />
                All document types
              </CardTitle>
              <CardDescription>Search and browse registered document types.</CardDescription>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <ActiveStatusFilter value={statusFilter} onChange={setStatusFilter} />
              <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or codeâ€¦"
                className="pl-9"
              />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {documentTypes.isFetching && !documentTypes.data ? <LoadingState />
              : documentTypes.isError ? <ErrorState message="Could not load document types." onRetry={() => documentTypes.refetch()} />
              : !filtered.length ? (
                <EmptyState
                  title={search.trim() ? "No matching document types" : "No document types yet"}
                  description={search.trim() ? "Try a different search term." : "Create your first document type above."}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Amount required</TableHead>
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
                        <TableCell>
                          <Badge variant="secondary">
                            {t.category === "financial" ? "Financial" : "Non-financial"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {t.category === "financial"
                            ? <Badge variant={t.amountRequired ? "outline" : "secondary"}>{t.amountRequired ? "Yes" : "No"}</Badge>
                            : "â€”"}
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-sm text-muted-foreground">{t.description ?? "â€”"}</TableCell>
                        <TableCell>
                          <ActiveStatusBadge active={t.isActive} />
                        </TableCell>
                        <TableCell>
                          {can(P.config.documentTypesCheck) ? (
                            <ActiveStatusSwitch
                              id={`doctype-active-${t.id}`}
                              active={t.isActive}
                              label=""
                              onChange={(isActive) => toggleDocumentTypeStatus(t, isActive)}
                            />
                          ) : (
                            <ActiveStatusBadge active={t.isActive} />
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {can(P.config.documentTypesMake) && (
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                            )}
                            {can(P.config.documentTypesCheck) && (
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
            <SheetTitle>Edit document type</SheetTitle>
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
            <Button onClick={saveEdit} disabled={saving || !editName.trim()}>{saving ? "Savingâ€¦" : "Save"}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!deleteType}
        onOpenChange={(open) => { if (!open) setDeleteType(null); }}
        title="Deactivate this document type?"
        description={deleteType ? `${deleteType.name} will be set to inactive.` : ""}
        confirmLabel="Deactivate"
        variant="destructive"
        onConfirm={async () => {
          if (!deleteType) return;
          await wdasConfig.deleteDocumentType(deleteType.id);
          toast.success("Document type deactivated");
          setDeleteType(null);
          documentTypes.refetch();
          qc.invalidateQueries({ queryKey: ["document-types"] });
        }}
      />
    </div>
  );
}
