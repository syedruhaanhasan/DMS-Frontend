import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/wdas/page-header";
import { useSession } from "@/lib/wdas/role-context";
import { wdas } from "@/services/wdas";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/wdas/data-states";
import {
  ShieldCheck,
  ShieldAlert,
  ScrollText,
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import type { ApiAuditLogEntryDto } from "@/lib/api/types";
import { formatAuditDetails, auditDetailsSearchText } from "@/lib/wdas/audit-details";

export const Route = createFileRoute("/audit-log")({
  component: AuditLogPage,
});

const PAGE_SIZE = 10;

function eventTone(eventType: string): string {
  const e = eventType.toLowerCase();
  if (e.includes("reject") || e.includes("delete") || e.includes("cancel")) return "bg-destructive/10 text-destructive";
  if (e.includes("approve") || e.includes("finaliz")) return "bg-success/10 text-success";
  if (e.includes("return") || e.includes("escalat")) return "bg-warning/15 text-warning-foreground";
  if (e.includes("export") || e.includes("login") || e.includes("view")) return "bg-info/10 text-info";
  return "bg-muted text-muted-foreground";
}

function AuditLogPage() {
  const router = useRouter();
  const { hasAnyRole } = useSession();
  const allowed = hasAnyRole(["super_admin", "auditor"]);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!allowed) router.navigate({ to: "/dashboard" });
  }, [allowed, router]);

  const q = useQuery({
    queryKey: ["audit-log", fromDate, toDate],
    queryFn: () =>
      wdas.exportAudit({
        fromUtc: fromDate ? new Date(fromDate).toISOString() : null,
        toUtc: toDate ? new Date(`${toDate}T23:59:59`).toISOString() : null,
      }),
    enabled: allowed,
  });

  const entries = useMemo(() => {
    const rows = q.data?.entries ?? [];
    if (!term.trim()) return rows;
    const t = term.toLowerCase();
    return rows.filter((e) =>
      [e.action, e.eventType, e.actorDisplayName, e.documentId, e.ipAddress, auditDetailsSearchText(e.detailsJson)]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(t)),
    );
  }, [q.data, term]);

  useEffect(() => {
    setPage(1);
  }, [fromDate, toDate, term]);

  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageEntries = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return entries.slice(start, start + PAGE_SIZE);
  }, [entries, currentPage]);
  const rangeStart = entries.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, entries.length);

  const doExport = () => {
    const rows = q.data?.entries ?? [];
    if (!rows.length) {
      toast.error("Nothing to export for the selected range.");
      return;
    }
    const header = ["Seq", "Timestamp", "Actor", "Event", "Action", "Changes", "Document", "Entity", "IP", "Hash"];
    const csv = [
      header.join(","),
      ...rows.map((e: ApiAuditLogEntryDto) =>
        [
          e.sequenceNumber,
          e.createdAtUtc,
          e.actorDisplayName ?? "System",
          e.eventType,
          e.action,
          formatAuditDetails(e.detailsJson),
          e.documentId ?? "",
          e.entityType ?? "",
          e.ipAddress ?? "",
          e.entryHash,
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} audit entries.`);
  };

  if (!allowed) return null;

  const chainValid = q.data?.chainValid;

  return (
    <div>
      <PageHeader
        title="Audit Log"
        subtitle="Tamper-evident record of every system action, ordered and hash-chained."
        actions={
          <Button onClick={doExport} className="bg-primary text-primary-foreground hover:bg-primary-hover">
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        }
      />

      <div className="page-shell">
        {q.data && (
          <div
            className={`flex items-center gap-3 rounded-xl border p-4 ${
              chainValid
                ? "border-success/30 bg-success/5 text-success"
                : "border-destructive/30 bg-destructive/5 text-destructive"
            }`}
          >
            {chainValid ? <ShieldCheck className="h-5 w-5 shrink-0" /> : <ShieldAlert className="h-5 w-5 shrink-0" />}
            <div>
              <p className="text-sm font-semibold text-foreground">
                {chainValid ? "Audit chain verified" : "Audit chain integrity warning"}
              </p>
              <p className="text-xs text-muted-foreground">
                {q.data.chainValidationMessage ??
                  (chainValid
                    ? "The hash chain is intact — no records have been altered or removed."
                    : "The hash chain could not be fully verified.")}
              </p>
            </div>
          </div>
        )}

        <Card>
          <CardContent className="grid gap-3 p-4 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs">From date</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} max={toDate || undefined} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">To date</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} min={fromDate || undefined} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Action, actor, document, IP…" className="pl-8" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {q.isFetching && !q.data ? (
              <LoadingState />
            ) : q.isError ? (
              <ErrorState message="Could not load the audit log. Auditor or Super Admin access is required." onRetry={() => q.refetch()} />
            ) : !entries.length ? (
              <EmptyState icon={<ScrollText className="h-8 w-8" />} title="No audit entries" description="No recorded actions match the selected range." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Seq</th>
                      <th className="px-4 py-3 font-medium">Timestamp</th>
                      <th className="px-4 py-3 font-medium">Actor</th>
                      <th className="px-4 py-3 font-medium">Event</th>
                      <th className="px-4 py-3 font-medium">Action</th>
                      <th className="px-4 py-3 font-medium">Changes</th>
                      <th className="px-4 py-3 font-medium">Document</th>
                      <th className="px-4 py-3 font-medium">IP</th>
                      <th className="px-4 py-3 font-medium">Hash</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageEntries.map((e) => (
                      <tr key={e.sequenceNumber} className="border-b last:border-0">
                        <td className="px-4 py-3 font-mono tabular-nums text-muted-foreground">{e.sequenceNumber}</td>
                        <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted-foreground">
                          {new Date(e.createdAtUtc).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 font-medium">{e.actorDisplayName ?? "System"}</td>
                        <td className="px-4 py-3">
                          <Badge className={`border-transparent ${eventTone(e.eventType)}`}>{e.eventType}</Badge>
                        </td>
                        <td className="max-w-xs truncate px-4 py-3 text-muted-foreground" title={e.action}>{e.action}</td>
                        <td className="max-w-md px-4 py-3 text-muted-foreground" title={formatAuditDetails(e.detailsJson)}>
                          {formatAuditDetails(e.detailsJson)}
                        </td>
                        <td className="px-4 py-3 font-mono text-muted-foreground">{e.documentId ?? "—"}</td>
                        <td className="px-4 py-3 font-mono text-muted-foreground">{e.ipAddress ?? "—"}</td>
                        <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground" title={e.entryHash}>
                          {e.entryHash ? `${e.entryHash.slice(0, 10)}…` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {q.data && entries.length > 0 && (
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Showing {rangeStart}–{rangeEnd} of {entries.length} entries · {PAGE_SIZE} per page · read-only, retained for
              compliance.
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Previous
              </Button>
              <span className="min-w-[7rem] text-center text-sm tabular-nums text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {q.data && entries.length === 0 && (
          <p className="text-center text-xs text-muted-foreground">
            Showing 0 of {q.data.entries.length} entries · read-only, retained for compliance.
          </p>
        )}
      </div>
    </div>
  );
}
