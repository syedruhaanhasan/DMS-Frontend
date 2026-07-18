import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { PageHeader } from "@/components/wdas/page-header";
import { LoadingState, ErrorState, EmptyState } from "@/components/wdas/data-states";
import { useSession } from "@/lib/wdas/role-context";
import { wdas } from "@/services/wdas";
import { useUsers } from "@/lib/wdas/users-context";
import { wdasConfig } from "@/services/wdas-config";
import { DEPARTMENTS, type Department } from "@/lib/wdas/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  BarChart3, Download, Clock, FileText, ShieldCheck, XCircle, ChevronDown,
  CalendarClock, FileSpreadsheet, Gauge, PieChart as PieChartIcon, Route as RouteIcon, TimerReset,
} from "lucide-react";
import { toast } from "sonner";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend,
} from "recharts";

export const Route = createFileRoute("/reports")({
  component: ReportsPage,
});

const COLORS = ["var(--primary)", "var(--success)", "var(--warning)", "var(--destructive)", "var(--info)"];
const REPORT_TYPES = [
  { title: "Executive overview", detail: "Volume, cycle time and SLA health", icon: Gauge },
  { title: "Approval performance", detail: "Department and approver throughput", icon: BarChart3 },
  { title: "Workflow efficiency", detail: "Routing performance and bottlenecks", icon: RouteIcon },
  { title: "SLA compliance", detail: "On-time rates and breached approvals", icon: ShieldCheck },
  { title: "Outcome analysis", detail: "Approval and rejection distribution", icon: PieChartIcon },
  { title: "Audit extract", detail: "Detailed document-level activity", icon: FileSpreadsheet },
];

function ReportsPage() {
  const router = useRouter();
  const { role, hasAnyRole } = useSession();
  useEffect(() => {
    if (!hasAnyRole(["super_admin", "dept_admin", "auditor"])) router.navigate({ to: "/dashboard" });
  }, [hasAnyRole, router]);

  const [dept, setDept] = useState<Department | "all">("all");
  const [wfId, setWfId] = useState<string>("all");
  const [range, setRange] = useState<"30" | "90" | "180" | "all">("90");

  const { users } = useUsers();
  const workflowsQ = useQuery({ queryKey: ["workflows"], queryFn: () => wdasConfig.listWorkflows("all") });
  const workflows = workflowsQ.data ?? [];

  const metricsQ = useQuery({
    queryKey: ["reports", "success-metrics"],
    queryFn: () => wdas.getSuccessMetrics(),
    enabled: hasAnyRole(["super_admin", "dept_admin", "auditor"]),
  });

  const q = useQuery({ queryKey: ["docs", "all"], queryFn: () => wdas.listDocuments() });

  const filtered = useMemo(() => {
    const rows = q.data ?? [];
    return rows.filter((d) => {
      const owner = users.find((u) => u.id === d.ownerId);
      if (dept !== "all" && owner?.department !== dept) return false;
      if (wfId !== "all" && d.workflowId !== wfId) return false;
      if (range !== "all") {
        const cutoff = Date.now() - Number(range) * 86400000;
        if (new Date(d.createdAt).getTime() < cutoff) return false;
      }
      return true;
    });
  }, [q.data, dept, wfId, range]);

  const totals = useMemo(() => {
    const total = filtered.length;
    const closed = filtered.filter((d) => d.finalizedAt);
    const avgCycle = closed.length
      ? Math.round(closed.reduce((sum, d) => sum + (new Date(d.finalizedAt!).getTime() - new Date(d.createdAt).getTime()) / 86400000, 0) / closed.length * 10) / 10
      : 0;
    const onTime = filtered.filter((d) => d.sla === "on_time").length;
    const compliance = total ? Math.round((onTime / total) * 100) : 0;
    const rejected = filtered.filter((d) => d.status === "rejected").length;
    const rejectionRate = total ? Math.round((rejected / total) * 100 * 10) / 10 : 0;
    return { total, avgCycle, compliance, rejectionRate };
  }, [filtered]);

  const cycleByDept = useMemo(() => {
    const map = new Map<string, { total: number; sum: number }>();
    DEPARTMENTS.forEach((d) => map.set(d, { total: 0, sum: 0 }));
    filtered.forEach((d) => {
      if (!d.finalizedAt) return;
      const owner = users.find((u) => u.id === d.ownerId);
      if (!owner) return;
      const days = (new Date(d.finalizedAt).getTime() - new Date(d.createdAt).getTime()) / 86400000;
      const entry = map.get(owner.department)!;
      entry.total += 1;
      entry.sum += days;
    });
    return Array.from(map.entries()).map(([name, v]) => ({
      name, avgDays: v.total ? Math.round((v.sum / v.total) * 10) / 10 : 0,
    }));
  }, [filtered]);

  const volumeTrend = useMemo(() => {
    // Bucket by ISO week for last 12 weeks
    const now = Date.now();
    const buckets: { week: string; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const end = now - i * 7 * 86400000;
      const start = end - 7 * 86400000;
      const label = new Date(end).toISOString().slice(5, 10);
      const count = filtered.filter((d) => {
        const t = new Date(d.createdAt).getTime();
        return t >= start && t < end;
      }).length;
      buckets.push({ week: label, count });
    }
    return buckets;
  }, [filtered]);

  const rejectionByStatus = useMemo(() => {
    const map: Record<string, number> = { approved: 0, rejected: 0, returned: 0, cancelled: 0, pending: 0, draft: 0 };
    filtered.forEach((d) => { map[d.status] = (map[d.status] ?? 0) + 1; });
    return Object.entries(map).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const bottleneckByStep = useMemo(() => {
    const map = new Map<string, { total: number; sum: number }>();
    filtered.forEach((d) => {
      d.steps.forEach((s, i) => {
        if (!s.actedAt || i === 0) return;
        const prev = d.steps[i - 1];
        const prevTime = prev.actedAt ? new Date(prev.actedAt).getTime() : new Date(d.submittedAt ?? d.createdAt).getTime();
        const wait = (new Date(s.actedAt).getTime() - prevTime) / 3600000; // hours
        const approver = users.find((u) => u.id === s.approverId)?.name ?? "Unknown";
        const entry = map.get(approver) ?? { total: 0, sum: 0 };
        entry.total += 1; entry.sum += Math.max(0, wait);
        map.set(approver, entry);
      });
    });
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, avgHours: Math.round((v.sum / v.total) * 10) / 10 }))
      .sort((a, b) => b.avgHours - a.avgHours).slice(0, 6);
  }, [filtered]);

  const doExport = () => {
    toast.success("Export queued", {
      description: `${filtered.length} rows will be downloaded as reports-${new Date().toISOString().slice(0, 10)}.xlsx`,
    });
  };

  return (
    <div className="min-h-full bg-[#f6f4ef] dark:bg-[#090b0f]">
      <PageHeader
        title="Reports & Analytics"
        subtitle={role === "auditor" ? "Read-only audit view across all departments." : "Approval performance across the organization."}
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="border border-amber-300 bg-amber-400 text-zinc-950 shadow-[0_8px_24px_-12px_rgba(245,158,11,.8)] hover:bg-amber-300">
                <Download className="mr-2 h-4 w-4" /> Export report <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={doExport}><FileSpreadsheet className="mr-2 h-4 w-4" /> Excel workbook</DropdownMenuItem>
              <DropdownMenuItem onClick={doExport}><FileText className="mr-2 h-4 w-4" /> PDF summary</DropdownMenuItem>
              <DropdownMenuItem onClick={doExport}><Download className="mr-2 h-4 w-4" /> CSV data extract</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
      <div className="space-y-7 p-6 lg:p-8">
        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.22em] text-amber-600">Report library</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">Choose an analytical view</h2>
            </div>
            <p className="hidden text-sm text-muted-foreground md:block">Six live views · one governed data source</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {REPORT_TYPES.map(({ title, detail, icon: Icon }, index) => (
              <button
                key={title}
                type="button"
                className={`group flex min-h-28 items-start gap-4 rounded-xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-lg ${
                  index === 0 ? "border-amber-400 bg-zinc-950 text-white shadow-lg" : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
                }`}
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${index === 0 ? "bg-amber-400 text-zinc-950" : "bg-amber-400/15 text-amber-600"}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block font-semibold">{title}</span>
                  <span className={`mt-1 block text-xs leading-5 ${index === 0 ? "text-zinc-400" : "text-muted-foreground"}`}>{detail}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <Card className="overflow-hidden border-0 bg-zinc-950 text-zinc-50 shadow-xl">
          <div className="border-b border-white/10 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[.2em] text-amber-400">Report parameters</p>
            <p className="mt-1 text-sm text-zinc-400">Refine every metric and visualization below.</p>
          </div>
          <CardContent className="grid gap-4 p-5 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-400">Department</Label>
              <Select value={dept} onValueChange={(v) => setDept(v as Department | "all")}>
                <SelectTrigger className="border-zinc-700 bg-zinc-900 text-zinc-100"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All departments</SelectItem>
                  {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-400">Workflow</Label>
              <Select value={wfId} onValueChange={setWfId}>
                <SelectTrigger className="border-zinc-700 bg-zinc-900 text-zinc-100"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All workflows</SelectItem>
                  {workflows.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-400">Date range</Label>
              <Select value={range} onValueChange={(v) => setRange(v as typeof range)}>
                <SelectTrigger className="border-zinc-700 bg-zinc-900 text-zinc-100"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                  <SelectItem value="180">Last 180 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <div className="w-full rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2.5 text-xs text-amber-200">
                <span className="font-semibold text-amber-400">{filtered.length}</span> document{filtered.length === 1 ? "" : "s"} in view
              </div>
            </div>
          </CardContent>
        </Card>

        {metricsQ.data && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Tile icon={<Clock className="h-4 w-4" />} label="Avg cycle time (API)" value={`${metricsQ.data.averageCycleTimeDays} d`} />
            <Tile icon={<FileText className="h-4 w-4" />} label="Adoption rate (30d)" value={`${metricsQ.data.adoptionRatePercent}%`} />
            <Tile icon={<ShieldCheck className="h-4 w-4" />} label="SLA compliance" value={`${metricsQ.data.slaCompliancePercent}%`} tone={metricsQ.data.slaCompliancePercent >= 80 ? "success" : "warning"} />
            <Tile icon={<XCircle className="h-4 w-4" />} label="SLA breaches" value={String(metricsQ.data.slaBreachCount)} />
            <Tile icon={<BarChart3 className="h-4 w-4" />} label="Submissions (30d)" value={String(metricsQ.data.documentsSubmittedLast30Days)} />
            <Tile icon={<BarChart3 className="h-4 w-4" />} label="Audit exports (30d)" value={String(metricsQ.data.auditExportCount)} />
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Tile icon={<FileText className="h-4 w-4" />} label="Total documents" value={totals.total.toString()} />
          <Tile icon={<Clock className="h-4 w-4" />} label="Avg cycle time" value={`${totals.avgCycle} d`} />
          <Tile icon={<ShieldCheck className="h-4 w-4" />} label="SLA compliance" value={`${totals.compliance}%`} tone={totals.compliance >= 80 ? "success" : totals.compliance >= 60 ? "warning" : "danger"} />
          <Tile icon={<XCircle className="h-4 w-4" />} label="Rejection rate" value={`${totals.rejectionRate}%`} tone={totals.rejectionRate <= 10 ? "success" : totals.rejectionRate <= 25 ? "warning" : "danger"} />
        </div>

        {q.isLoading ? <Card><CardContent><LoadingState /></CardContent></Card>
          : q.isError ? <Card><CardContent><ErrorState message="Could not load analytics." onRetry={() => q.refetch()} /></CardContent></Card>
          : filtered.length === 0 ? <Card><CardContent><EmptyState icon={<BarChart3 className="h-8 w-8" />} title="No data for these filters" description="Adjust the date range or department to see analytics." /></CardContent></Card>
          : (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="border-zinc-200 shadow-sm dark:border-zinc-800">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Avg approval time by department <span className="font-normal text-muted-foreground">(days)</span></CardTitle></CardHeader>
                <CardContent className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cycleByDept}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} />
                      <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                      <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", fontSize: 12 }} />
                      <Bar dataKey="avgDays" fill="#f59e0b" radius={[5, 5, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border-zinc-200 shadow-sm dark:border-zinc-800">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Volume over time (last 12 weeks)</CardTitle></CardHeader>
                <CardContent className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={volumeTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="week" stroke="var(--muted-foreground)" fontSize={11} />
                      <YAxis stroke="var(--muted-foreground)" fontSize={11} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", fontSize: 12 }} />
                      <Line type="monotone" dataKey="count" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3, fill: "#18181b" }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border-zinc-200 shadow-sm dark:border-zinc-800">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Outcomes distribution</CardTitle></CardHeader>
                <CardContent className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={rejectionByStatus} dataKey="value" nameKey="name" outerRadius={90} label={(e) => e.name}>
                        {rejectionByStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border-zinc-200 shadow-sm dark:border-zinc-800">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Bottleneck: avg wait per approver (hrs)</CardTitle></CardHeader>
                <CardContent className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={bottleneckByStep} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis type="number" stroke="var(--muted-foreground)" fontSize={11} />
                      <YAxis dataKey="name" type="category" width={120} stroke="var(--muted-foreground)" fontSize={11} />
                      <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", fontSize: 12 }} />
                      <Bar dataKey="avgHours" fill="#f59e0b" radius={[0, 5, 5, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}

        {!!filtered.length && (
          <Card className="overflow-hidden border-zinc-200 shadow-sm dark:border-zinc-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b bg-zinc-50/80 dark:bg-zinc-950">
              <div>
                <CardTitle className="text-base">Report detail</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Most recent documents matching the selected parameters.</p>
              </div>
              <Badge variant="outline" className="border-amber-400/50 bg-amber-400/10 text-amber-700">{filtered.length} records</Badge>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Document</TableHead><TableHead>Workflow</TableHead><TableHead>Status</TableHead><TableHead>SLA</TableHead><TableHead>Created</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filtered.slice(0, 8).map((document) => (
                    <TableRow key={document.id}>
                      <TableCell className="font-medium">{document.subject}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{workflows.find((workflow) => workflow.id === document.workflowId)?.name ?? "—"}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{document.status}</Badge></TableCell>
                      <TableCell className="capitalize">{document.sla.replace("_", " ")}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{new Date(document.createdAt).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <Card className="overflow-hidden border-0 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 text-white shadow-xl">
          <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-zinc-950"><CalendarClock className="h-6 w-6" /></span>
              <div>
                <h3 className="font-semibold">Scheduled reports</h3>
                <p className="mt-1 max-w-xl text-sm text-zinc-400">Deliver this filtered report to stakeholders on a recurring cadence. Scheduling is managed by your reporting administrator.</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => toast.info("Report scheduling is managed by your administrator.")} className="border-zinc-700 bg-transparent text-white hover:border-amber-400 hover:bg-amber-400 hover:text-zinc-950">
              <TimerReset className="mr-2 h-4 w-4" /> View schedules
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Tile({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: "success" | "warning" | "danger" }) {
  const toneCls = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "danger" ? "text-destructive" : "text-foreground";
  return (
    <Card className="border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <CardContent className="flex items-start justify-between p-5">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className={`mt-1 text-2xl font-bold ${toneCls}`}>{value}</p>
        </div>
        <div className="rounded-lg bg-amber-400/15 p-2.5 text-amber-600">{icon}</div>
      </CardContent>
    </Card>
  );
}
