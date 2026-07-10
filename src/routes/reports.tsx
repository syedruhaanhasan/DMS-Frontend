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
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, Download, Clock, FileText, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend,
} from "recharts";

export const Route = createFileRoute("/reports")({
  component: ReportsPage,
});

const COLORS = ["var(--primary)", "var(--success)", "var(--warning)", "var(--destructive)", "var(--info)"];

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
    <div>
      <PageHeader
        title="Reports & Analytics"
        subtitle={role === "auditor" ? "Read-only audit view across all departments." : "Approval performance across the organization."}
        actions={<Button variant="outline" onClick={doExport}><Download className="mr-1 h-4 w-4" /> Export</Button>}
      />
      <div className="space-y-6 p-6">
        {/* Filters */}
        <Card>
          <CardContent className="grid gap-3 p-4 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Department</Label>
              <Select value={dept} onValueChange={(v) => setDept(v as Department | "all")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All departments</SelectItem>
                  {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Workflow</Label>
              <Select value={wfId} onValueChange={setWfId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All workflows</SelectItem>
                  {workflows.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Date range</Label>
              <Select value={range} onValueChange={(v) => setRange(v as typeof range)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                  <SelectItem value="180">Last 180 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end text-xs text-muted-foreground">
              {filtered.length} document{filtered.length === 1 ? "" : "s"} in view
            </div>
          </CardContent>
        </Card>

        {/* Success metrics from API */}
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

        {/* Summary tiles */}
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
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Avg approval time by department (days)</CardTitle></CardHeader>
                <CardContent className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cycleByDept}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} />
                      <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                      <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", fontSize: 12 }} />
                      <Bar dataKey="avgDays" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Volume over time (last 12 weeks)</CardTitle></CardHeader>
                <CardContent className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={volumeTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="week" stroke="var(--muted-foreground)" fontSize={11} />
                      <YAxis stroke="var(--muted-foreground)" fontSize={11} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", fontSize: 12 }} />
                      <Line type="monotone" dataKey="count" stroke="var(--info)" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
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

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Bottleneck: avg wait per approver (hrs)</CardTitle></CardHeader>
                <CardContent className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={bottleneckByStep} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis type="number" stroke="var(--muted-foreground)" fontSize={11} />
                      <YAxis dataKey="name" type="category" width={120} stroke="var(--muted-foreground)" fontSize={11} />
                      <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", fontSize: 12 }} />
                      <Bar dataKey="avgHours" fill="var(--warning)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}
      </div>
    </div>
  );
}

function Tile({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: "success" | "warning" | "danger" }) {
  const toneCls = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "danger" ? "text-destructive" : "text-foreground";
  return (
    <Card>
      <CardContent className="flex items-start justify-between p-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className={`mt-1 text-2xl font-bold ${toneCls}`}>{value}</p>
        </div>
        <div className="rounded-md bg-muted p-2 text-muted-foreground">{icon}</div>
      </CardContent>
    </Card>
  );
}
