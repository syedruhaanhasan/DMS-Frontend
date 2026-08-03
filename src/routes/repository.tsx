import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { wdas } from "@/services/wdas";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DocumentTable } from "@/components/wdas/document-table";
import { StatusBadge } from "@/components/wdas/badges";
import { LoadingState, ErrorState, EmptyState } from "@/components/wdas/data-states";
import { useState, useMemo } from "react";
import {
  Archive,
  CheckSquare2,
  ChevronDown,
  Download,
  FileText,
  FolderArchive,
  FolderSearch,
  Grid2X2,
  List,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { DEPARTMENTS, REPOSITORY_DOC_STATUSES, type DocStatus, type Department } from "@/lib/wdas/types";
import { useUsers } from "@/lib/wdas/users-context";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import { useCanFetchDocuments } from "@/lib/wdas/use-document-query";
import { Checkbox } from "@/components/ui/checkbox";
import { formatPKR } from "@/lib/wdas/format";
import { useSession } from "@/lib/wdas/role-context";
import { endOfDay, startOfDay } from "date-fns";

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
  docId: "",
  subject: "",
  ownerId: "all",
  approverId: "all",
  status: "all",
  department: "all",
  dateFrom: undefined,
  dateTo: undefined,
  amountMin: "",
  amountMax: "",
};

function Repository() {
  const [f, setF] = useState<Filters>(EMPTY);
  const [expanded, setExpanded] = useState(true);
  const [view, setView] = useState<"list" | "grid">("list");
  const [year, setYear] = useState("all");
  const [documentType, setDocumentType] = useState<"all" | "financial" | "general">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { users } = useUsers();
  const { user, role } = useSession();
  const canFetch = useCanFetchDocuments();
  const q = useQuery({
    queryKey: ["docs", "repository"],
    queryFn: () => wdas.listRepositoryDocuments(),
    enabled: canFetch,
  });
  const historyScope =
    role === "super_admin" || role === "auditor"
      ? "org"
      : role === "dept_admin"
        ? "department"
        : "personal";
  const historySubtitle =
    historyScope === "org"
      ? "Organization-wide documents and workflow actions."
      : historyScope === "department"
        ? "History for all users in your department — owned documents and their approve/reject/return/comment actions."
        : "Your personal history — documents you own and every approve/reject/return/comment action you took.";
  const emptyDescription =
    historyScope === "org"
      ? "Try adjusting your advanced filters."
      : historyScope === "department"
        ? "No department history matches these filters."
        : "No personal history matches these filters.";

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
      if (k === "dateFrom" || k === "dateTo") {
        if (f[k]) n++;
      } else if (v && v !== dv) {
        n++;
      }
    });
    return n;
  }, [f]);

  const filtered = useMemo(() => {
    if (!q.data) return [];
    return q.data.filter((d) => {
      if (!REPOSITORY_DOC_STATUSES.includes(d.status)) return false;
      if (f.docId && !(d.refId ?? d.id).toLowerCase().includes(f.docId.toLowerCase())) return false;
      if (f.subject && !d.subject.toLowerCase().includes(f.subject.toLowerCase())) return false;
      if (f.ownerId !== "all" && d.ownerId !== f.ownerId) return false;
      if (f.approverId !== "all" && !d.steps.some((s) => s.approverId === f.approverId))
        return false;
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
      if (year !== "all" && new Date(d.createdAt).getFullYear().toString() !== year) return false;
      if (documentType === "financial" && d.amount == null) return false;
      if (documentType === "general" && d.amount != null) return false;
      return true;
    });
  }, [q.data, f, users, year, documentType]);

  const years = useMemo(
    () =>
      [...new Set((q.data ?? []).map((d) => new Date(d.createdAt).getFullYear()))].sort(
        (a, b) => b - a,
      ),
    [q.data],
  );

  const allFiltersCount = activeCount + (year !== "all" ? 1 : 0) + (documentType !== "all" ? 1 : 0);

  const upd = <K extends keyof Filters>(k: K, v: Filters[K]) =>
    setF((prev) => ({ ...prev, [k]: v }));
  const clearFilters = () => {
    setF(EMPTY);
    setYear("all");
    setDocumentType("all");
  };
  const toggleSelected = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const selectVisible = () => {
    const visibleIds = filtered.map((doc) => doc.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
    setSelected((current) => {
      const next = new Set(current);
      visibleIds.forEach((id) => (allVisibleSelected ? next.delete(id) : next.add(id)));
      return next;
    });
  };

  return (
    <div className="min-h-full bg-background">
      <header className="relative overflow-hidden border-b border-border bg-card px-6 py-7 text-foreground sm:px-8">
        <div className="absolute right-8 top-0 h-44 w-44 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative mx-auto max-w-[1500px]">
          <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-400">
            <FolderArchive className="h-3.5 w-3.5" />
            Enterprise archive
          </div>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Document History
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">{historySubtitle}</p>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/60 p-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setView("list")}
                className={cn(
                  "h-8 px-3 text-muted-foreground hover:bg-background hover:text-foreground",
                  view === "list" &&
                    "bg-primary text-primary-foreground hover:bg-primary-hover hover:text-primary-foreground",
                )}
              >
                <List className="mr-1.5 h-4 w-4" /> List
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setView("grid")}
                className={cn(
                  "h-8 px-3 text-muted-foreground hover:bg-background hover:text-foreground",
                  view === "grid" &&
                    "bg-primary text-primary-foreground hover:bg-primary-hover hover:text-primary-foreground",
                )}
              >
                <Grid2X2 className="mr-1.5 h-4 w-4" /> Grid
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] space-y-4 p-6 sm:p-8">
          <Card className="overflow-hidden border-border shadow-sm">
            <Collapsible open={expanded} onOpenChange={setExpanded}>
              <CollapsibleTrigger asChild>
                <button className="flex w-full items-center justify-between border-b border-border px-5 py-4 text-left hover:bg-amber-50/50 dark:hover:bg-amber-400/10">
                  <div className="flex items-center gap-2.5">
                    <SlidersHorizontal className="h-4 w-4 text-amber-600" />
                    <p className="text-sm font-semibold text-foreground">Advanced search</p>
                    {allFiltersCount > 0 && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-500/20 dark:text-amber-200">
                        {allFiltersCount} active
                      </span>
                    )}
                  </div>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform",
                      !expanded && "-rotate-90",
                    )}
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="grid gap-3 bg-card p-5 md:grid-cols-3 xl:grid-cols-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Document ID / Ref</Label>
                    <Input
                      value={f.docId}
                      onChange={(e) => upd("docId", e.target.value)}
                      placeholder="WDAS-2026-…"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Subject</Label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={f.subject}
                        onChange={(e) => upd("subject", e.target.value)}
                        placeholder="Search subject…"
                        className="pl-8"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Owner</Label>
                    <Select value={f.ownerId} onValueChange={(v) => upd("ownerId", v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All owners</SelectItem>
                        {ownerOptions.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Approver</Label>
                    <Select value={f.approverId} onValueChange={(v) => upd("approverId", v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Any approver</SelectItem>
                        {approverOptions.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Status</Label>
                    <Select
                      value={f.status}
                      onValueChange={(v) => upd("status", v as DocStatus | "all")}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="ready_to_finalize">Ready to finalize</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Department</Label>
                    <Select
                      value={f.department}
                      onValueChange={(v) => upd("department", v as Department | "all")}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All departments</SelectItem>
                        {DEPARTMENTS.map((d) => (
                          <SelectItem key={d} value={d}>
                            {d}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Year</Label>
                    <Select value={year} onValueChange={setYear}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All years</SelectItem>
                        {years.map((item) => (
                          <SelectItem key={item} value={item.toString()}>
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Document type</Label>
                    <Select
                      value={documentType}
                      onValueChange={(v) =>
                        setDocumentType(v as "all" | "financial" | "general")
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All documents</SelectItem>
                        <SelectItem value="financial">Financial</SelectItem>
                        <SelectItem value="general">General</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs" htmlFor="repo-date-from">
                      From date
                    </Label>
                    <DatePicker
                      id="repo-date-from"
                      value={f.dateFrom}
                      onChange={(d) => upd("dateFrom", d)}
                      placeholder="Select start date"
                      maxDate={f.dateTo}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs" htmlFor="repo-date-to">
                      To date
                    </Label>
                    <DatePicker
                      id="repo-date-to"
                      value={f.dateTo}
                      onChange={(d) => upd("dateTo", d)}
                      placeholder="Select end date"
                      minDate={f.dateFrom}
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label className="text-xs">Amount range (PKR)</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min={0}
                        placeholder="Minimum"
                        value={f.amountMin}
                        onChange={(e) => upd("amountMin", e.target.value)}
                      />
                      <Input
                        type="number"
                        min={0}
                        placeholder="Maximum"
                        value={f.amountMax}
                        onChange={(e) => upd("amountMax", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex items-end md:col-span-3 xl:col-span-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      disabled={allFiltersCount === 0}
                    >
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

          <Card className="overflow-hidden border-border shadow-sm">
            <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/40 px-4 py-3 text-foreground">
              <Button
                variant="ghost"
                size="sm"
                onClick={selectVisible}
                disabled={!filtered.length}
                className="text-muted-foreground hover:bg-background hover:text-foreground"
              >
                <CheckSquare2 className="mr-2 h-4 w-4" />
                {filtered.length > 0 && filtered.every((doc) => selected.has(doc.id))
                  ? "Clear visible"
                  : "Select visible"}
              </Button>
              <span className="text-xs text-muted-foreground">{selected.size} selected</span>
              <div className="ml-auto flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled
                  title="Export requires backend integration"
                  className="text-muted-foreground"
                >
                  <Download className="mr-1.5 h-4 w-4" /> Export
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled
                  title="Archive requires backend integration"
                  className="text-muted-foreground"
                >
                  <Archive className="mr-1.5 h-4 w-4" /> Archive
                </Button>
              </div>
            </div>
            <CardContent className="p-0">
              {q.isFetching && !q.data ? (
                <LoadingState />
              ) : q.isError ? (
                <ErrorState message="Could not load repository." onRetry={() => q.refetch()} />
              ) : !filtered.length ? (
                <EmptyState
                  icon={<FolderSearch className="h-8 w-8" />}
                  title="No documents match your filters"
                  description={emptyDescription}
                  action={
                    <Button variant="outline" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  }
                />
              ) : view === "list" ? (
                <DocumentTable docs={filtered} showStatus showHistoryActions />
              ) : (
                <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
                  {filtered.map((doc) => {
                    const owner = users.find((item) => item.id === doc.ownerId);
                    const linkTo =
                      doc.ownerId === user.id || doc.status !== "pending"
                        ? "/documents/$id"
                        : "/documents/$id/review";
                    return (
                      <article
                        key={doc.id}
                        className={cn(
                          "group relative rounded-xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md",
                          selected.has(doc.id)
                            ? "border-amber-400 ring-2 ring-amber-100 dark:ring-amber-400/20"
                            : "border-border",
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selected.has(doc.id)}
                            onCheckedChange={() => toggleSelected(doc.id)}
                            aria-label={`Select ${doc.subject}`}
                            className="mt-1 border-slate-400 data-[state=checked]:border-amber-400 data-[state=checked]:bg-amber-400 data-[state=checked]:text-slate-950"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="mb-3 flex items-start justify-between gap-2">
                              <div className="rounded-lg bg-amber-50 p-2 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                                <FileText className="h-4 w-4" />
                              </div>
                              <StatusBadge status={doc.status} />
                            </div>
                            <Link
                              to={linkTo}
                              params={{ id: doc.id }}
                              className="line-clamp-2 font-semibold text-foreground hover:text-amber-700 hover:underline"
                            >
                              {doc.subject}
                            </Link>
                            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                              {doc.refId ?? doc.id}
                            </p>
                            <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border pt-3 text-xs">
                              <div>
                                <dt className="text-muted-foreground">Owner</dt>
                                <dd className="mt-0.5 truncate font-medium text-foreground">
                                  {doc.ownerName ?? owner?.name ?? "—"}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-muted-foreground">Department</dt>
                                <dd className="mt-0.5 truncate font-medium text-foreground">
                                  {owner?.department ?? "—"}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-muted-foreground">Created</dt>
                                <dd className="mt-0.5 font-medium text-foreground">
                                  {new Date(doc.createdAt).toLocaleDateString()}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-muted-foreground">Amount</dt>
                                <dd className="mt-0.5 truncate font-mono font-medium text-foreground">
                                  {formatPKR(doc.amount)}
                                </dd>
                              </div>
                            </dl>
                            {doc.steps.length > 0 && (
                              <div className="mt-3 space-y-1.5 border-t border-border pt-3">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                  User actions
                                </p>
                                {doc.steps.map((step) => (
                                  <div key={step.id} className="rounded-md bg-muted/40 px-2 py-1.5 text-xs">
                                    <span className="font-semibold">{step.actorName ?? "User"}</span>
                                    <span className="mx-1 text-muted-foreground">·</span>
                                    <span>{step.actionType ?? step.status}</span>
                                    {step.comment ? (
                                      <p className="mt-0.5 line-clamp-2 text-muted-foreground">{step.comment}</p>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground">
            Looking for a document awaiting your action? Check your{" "}
            <Link to="/inbox" className="font-medium text-amber-700 hover:underline">
              inbox
            </Link>
            .
          </p>
      </div>
    </div>
  );
}
