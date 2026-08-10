import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/wdas/page-header";
import { useSession } from "@/lib/wdas/role-context";
import { wdas } from "@/services/wdas";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LoadingState, ErrorState, EmptyState } from "@/components/wdas/data-states";
import {
  Activity, Search, CheckCircle2, XCircle, RotateCcw, FileEdit, FilePlus2,
  LogIn, Download, ShieldCheck, Send, type LucideIcon,
} from "lucide-react";
import { parseApiDate, relTime } from "@/lib/wdas/format";
import type { ApiAuditLogEntryDto } from "@/lib/api/types";

export const Route = createFileRoute("/activity-log")({
  component: ActivityLogPage,
});

function eventVisual(eventType: string): { icon: LucideIcon; className: string } {
  const e = eventType.toLowerCase();
  if (e.includes("approve")) return { icon: CheckCircle2, className: "bg-success/10 text-success" };
  if (e.includes("reject")) return { icon: XCircle, className: "bg-destructive/10 text-destructive" };
  if (e.includes("return")) return { icon: RotateCcw, className: "bg-warning/15 text-warning-foreground" };
  if (e.includes("finaliz")) return { icon: ShieldCheck, className: "bg-success/10 text-success" };
  if (e.includes("submit")) return { icon: Send, className: "bg-info/10 text-info" };
  if (e.includes("create")) return { icon: FilePlus2, className: "bg-info/10 text-info" };
  if (e.includes("update") || e.includes("edit") || e.includes("revis")) return { icon: FileEdit, className: "bg-muted text-muted-foreground" };
  if (e.includes("login")) return { icon: LogIn, className: "bg-info/10 text-info" };
  if (e.includes("export")) return { icon: Download, className: "bg-info/10 text-info" };
  return { icon: Activity, className: "bg-primary/15 text-foreground" };
}

function initials(name: string): string {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase() || "SY";
}

function dayLabel(iso: string): string {
  const d = parseApiDate(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function ActivityLogPage() {
  const router = useRouter();
  const { hasAnyRole } = useSession();
  const allowed = hasAnyRole(["super_admin", "auditor", "dept_admin"]);

  const [term, setTerm] = useState("");

  useEffect(() => {
    if (!allowed) router.navigate({ to: "/dashboard" });
  }, [allowed, router]);

  const q = useQuery({
    queryKey: ["activity-log"],
    queryFn: () => wdas.exportAudit({}),
    enabled: allowed,
  });

  const grouped = useMemo(() => {
    let rows = [...(q.data?.entries ?? [])].sort(
      (a, b) => new Date(b.createdAtUtc).getTime() - new Date(a.createdAtUtc).getTime(),
    );
    if (term.trim()) {
      const t = term.toLowerCase();
      rows = rows.filter((e) =>
        [e.action, e.eventType, e.actorDisplayName, e.documentId]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(t)),
      );
    }
    const map = new Map<string, ApiAuditLogEntryDto[]>();
    for (const e of rows) {
      const key = dayLabel(e.createdAtUtc);
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [q.data, term]);

  const total = q.data?.entries.length ?? 0;

  if (!allowed) return null;

  return (
    <div>
      <PageHeader title="Activity Log" subtitle="A live, human-readable timeline of what everyone is doing across the system." />

      <div className="page-shell">
        <Card>
          <CardContent className="p-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Search activity</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Person, action, or document…" className="pl-8" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {q.isFetching && !q.data ? (
              <LoadingState />
            ) : q.isError ? (
              <ErrorState message="Could not load activity. Admin or Auditor access is required." onRetry={() => q.refetch()} />
            ) : !grouped.length ? (
              <EmptyState icon={<Activity className="h-8 w-8" />} title="No activity yet" description="Actions across the system will appear here as they happen." />
            ) : (
              <div className="p-5">
                {grouped.map(([day, items]) => (
                  <div key={day} className="mb-6 last:mb-0">
                    <div className="sticky top-0 z-10 -mx-1 mb-2 bg-card/95 px-1 py-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{day}</p>
                    </div>
                    <ol className="relative ml-3 space-y-4 border-l border-border pl-6">
                      {items.map((e) => {
                        const { icon: Icon, className } = eventVisual(e.eventType);
                        const actor = e.actorDisplayName ?? "System";
                        return (
                          <li key={e.sequenceNumber} className="relative">
                            <span className={`absolute -left-[33px] flex h-6 w-6 items-center justify-center rounded-full ${className}`}>
                              <Icon className="h-3.5 w-3.5" />
                            </span>
                            <div className="flex items-start gap-3">
                              <Avatar className="mt-0.5 h-8 w-8 shrink-0">
                                <AvatarFallback className="bg-primary/15 text-[11px] font-semibold text-foreground">{initials(actor)}</AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm leading-6">
                                  <span className="font-semibold text-foreground">{actor}</span>{" "}
                                  <span className="text-muted-foreground">{e.action}</span>
                                  {e.documentId && (
                                    <span className="font-mono text-xs text-muted-foreground"> · #{e.documentId}</span>
                                  )}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {relTime(e.createdAtUtc)} · {parseApiDate(e.createdAtUtc).toLocaleTimeString()}
                                </p>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {q.data && (
          <p className="text-center text-xs text-muted-foreground">{total} recorded activities</p>
        )}
      </div>
    </div>
  );
}
