import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/wdas/page-header";
import { wdas } from "@/services/wdas";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DocumentTable } from "@/components/wdas/document-table";
import { LoadingState, ErrorState, EmptyState } from "@/components/wdas/data-states";
import { useState, useMemo } from "react";
import { FolderSearch, Search, X } from "lucide-react";
import { DEPARTMENTS, type DocStatus, type Department } from "@/lib/wdas/types";
import { useUsers } from "@/lib/wdas/users-context";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DatePicker } from "@/components/ui/date-picker";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCanFetchDocuments } from "@/lib/wdas/use-document-query";

export const Route = createFileRoute("/repository")({
  component: Repository,
});

interface Filters {
  docId: string;
  subject: string;
  ownerId: string;
  approverId: string;
  status: DocStatus | "all";
  department: Department | "all";
  dateFrom?: Date;
  dateTo?: Date;
  amountMin: string;
  amountMax: string;
}

const EMPTY: Filters = {
  docId: "", subject: "", ownerId: "all", approverId: "all",
  status: "all", department: "all",
  dateFrom: undefined, dateTo: undefined,
  amountMin: "", amountMax: "",
};

function Repository() {
  const [f, setF] = useState<Filters>(EMPTY);
  const [expanded, setExpanded] = useState(true);

  const { users } = useUsers();
  const canFetch = useCanFetchDocuments();
  const q = useQuery({
    queryKey: ["docs", "all"],
    queryFn: () => wdas.listDocuments(),
    enabled: canFetch,
  });

  const { ownerOptions, approverOptions } = useMemo(() => {
    const docs = q.data ?? [];
    const ownerIds = new Set<string>();
    const approverIds = new Set<string>();

    for (const d of docs) {
      if (d.ownerId) ownerIds.add(d.ownerId);
      for (const s of d.steps) {
        if (s.approverId) approverIds.add(s.approverId);
      }
    }

    const userById = new Map(users.map((u) => [u.id, u]));

    const ownerOptions = [...ownerIds]
      .map((id) => ({
        id,
        name: userById.get(id)?.name ?? docs.find((d) => d.ownerId === id)?.ownerName ?? id,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const approverOptions = [...approverIds]
      .map((id) => ({
        id,
        name: userById.get(id)?.name ?? id,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return { ownerOptions, approverOptions };
  }, [q.data, users]);

  const activeCount = useMemo(() => {
    let n = 0;
    (Object.keys(EMPTY) as (keyof Filters)[]).forEach((k) => {
      const v = f[k];
      const dv = EMPTY[k];
      if (v instanceof Date || dv instanceof Date) {
        if (v?.getTime() !== dv?.getTime()) n++;
      } else if (v && v !== dv) {
        n++;
      }
    });
    return n;
  }, [f]);

  const filtered = useMemo(() => {
    if (!q.data) return [];
    return q.data.filter((d) => {
      if (f.docId && !(d.refId ?? d.id).toLowerCase().includes(f.docId.toLowerCase())) return false;
      if (f.subject && !d.subject.toLowerCase().includes(f.subject.toLowerCase())) return false;
      if (f.ownerId !== "all" && d.ownerId !== f.ownerId) return false;
      if (f.approverId !== "all" && !d.steps.some((s) => s.approverId === f.approverId)) return false;
      if (f.status !== "all" && d.status !== f.status) return false;
      if (f.department !== "all") {
        const owner = users.find((u) => u.id === d.ownerId);
        if (owner?.department !== f.department) return false;
      }
      const createdAt = new Date(d.createdAt).getTime();
      if (f.dateFrom && createdAt < startOfDay(f.dateFrom).getTime()) return false;
      if (f.dateTo && createdAt > endOfDay(f.dateTo).getTime()) return false;
      if (f.amountMin && (d.amount ?? 0) < Number(f.amountMin)) return false;
      if (f.amountMax && (d.amount ?? Number.MAX_SAFE_INTEGER) > Number(f.amountMax)) return false;
      return true;
    });
  }, [q.data, f]);

  const upd = <K extends keyof Filters>(k: K, v: Filters[K]) => setF((prev) => ({ ...prev, [k]: v }));

  return (
    <div>
      <PageHeader title="Repository" subtitle="Search and browse across all documents." />
      <div className="space-y-6 p-6">
        <Card>
          <Collapsible open={expanded} onOpenChange={setExpanded}>
            <CollapsibleTrigger asChild>
              <button className="flex w-full items-center justify-between border-b px-4 py-3 text-left hover:bg-muted/40">
                <div className="flex items-center gap-2">
                  <FolderSearch className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-semibold">Filters</p>
                  {activeCount > 0 && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{activeCount} active</span>}
                </div>
                <ChevronDown className={cn("h-4 w-4 transition-transform", !expanded && "-rotate-90")} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="grid gap-3 p-4 md:grid-cols-3 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Document ID / Ref</Label>
                  <Input value={f.docId} onChange={(e) => upd("docId", e.target.value)} placeholder="WDAS-2026-…" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Subject</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={f.subject} onChange={(e) => upd("subject", e.target.value)} placeholder="Search subject…" className="pl-8" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Owner</Label>
                  <Select value={f.ownerId} onValueChange={(v) => upd("ownerId", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All owners</SelectItem>
                      {ownerOptions.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Approver</Label>
                  <Select value={f.approverId} onValueChange={(v) => upd("approverId", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any approver</SelectItem>
                      {approverOptions.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Status</Label>
                  <Select value={f.status} onValueChange={(v) => upd("status", v as DocStatus | "all")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                      <SelectItem value="returned">Returned</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Department</Label>
                  <Select value={f.department} onValueChange={(v) => upd("department", v as Department | "all")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All departments</SelectItem>
                      {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor="repo-date-from">From date</Label>
                  <DatePicker
                    id="repo-date-from"
                    value={f.dateFrom}
                    onChange={(d) => upd("dateFrom", d)}
                    placeholder="Select start date"
                    maxDate={f.dateTo}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor="repo-date-to">To date</Label>
                  <DatePicker
                    id="repo-date-to"
                    value={f.dateTo}
                    onChange={(d) => upd("dateTo", d)}
                    placeholder="Select end date"
                    minDate={f.dateFrom}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Amount range (PKR)</Label>
                  <div className="flex gap-2">
                    <Input type="number" min={0} placeholder="Min" value={f.amountMin} onChange={(e) => upd("amountMin", e.target.value)} />
                    <Input type="number" min={0} placeholder="Max" value={f.amountMax} onChange={(e) => upd("amountMax", e.target.value)} />
                  </div>
                </div>
                <div className="flex items-end md:col-span-3 lg:col-span-4">
                  <Button variant="ghost" size="sm" onClick={() => setF(EMPTY)} disabled={activeCount === 0}>
                    <X className="mr-1 h-3.5 w-3.5" /> Clear filters
                  </Button>
                  <p className="ml-auto text-xs text-muted-foreground">
                    Showing {filtered.length} of {q.data?.length ?? 0} documents
                  </p>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        <Card>
          <CardContent className="p-0">
            {q.isFetching && !q.data ? <LoadingState />
              : q.isError ? <ErrorState message="Could not load repository." onRetry={() => q.refetch()} />
              : !filtered.length ? (
                <EmptyState
                  icon={<FolderSearch className="h-8 w-8" />}
                  title="No documents match your filters"
                  description="Try adjusting the filters above or clearing them."
                  action={<Button variant="outline" onClick={() => setF(EMPTY)}>Clear filters</Button>}
                />
              )
              : <DocumentTable docs={filtered} showStatus />}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Looking for a specific document you approved? Check your <Link to="/inbox" className="text-primary hover:underline">inbox</Link>.
        </p>
      </div>
    </div>
  );
}
