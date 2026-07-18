import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/wdas/page-header";
import { wdas } from "@/services/wdas";
import { useSession, isSuperAdmin } from "@/lib/wdas/role-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DocumentTable } from "@/components/wdas/document-table";
import { LoadingState, ErrorState, EmptyState } from "@/components/wdas/data-states";
import { Inbox, FileText, CheckCircle2, TrendingUp, ShieldCheck, Clock3, Sparkles, UserCheck } from "lucide-react";
import { DelegationBanner } from "@/components/wdas/delegation-banner";
import { useState } from "react";
import { ConfirmDialog } from "@/components/wdas/confirm-dialog";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import type { ApiVolumeTrendReportDto, ApiBottleneckReportDto, ApiSuccessMetricsDto } from "@/lib/api/types";
import { Link } from "@tanstack/react-router";
import { useCanFetchDocuments } from "@/lib/wdas/use-document-query";
import { refreshWorkflowViews } from "@/lib/wdas/refresh-workflow-queries";
import { AdminConfigAnalytics } from "@/components/wdas/admin-config-analytics";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
});

function SuperAdminDashboard() {
  const { user } = useSession();

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user.name.split(" ")[0]}`}
        subtitle="Super Admin workspace — live system analytics."
      />
      <div className="page-shell">
        <AdminConfigAnalytics />
      </div>
    </div>
  );
}

function Dashboard() {
  const { role, availableRoles } = useSession();
  const onlySuperAdmin = availableRoles.length === 1 && availableRoles[0] === "super_admin";
  if (isSuperAdmin(role) && onlySuperAdmin) return <SuperAdminDashboard />;
  return <StandardDashboard />;
}

function StandardDashboard() {
  const { user, hasAnyRole } = useSession();
  const qc = useQueryClient();
  const showAdminMetrics = hasAnyRole(["dept_admin", "super_admin"]);

  const canFetch = useCanFetchDocuments();
  const dashboardQ = useQuery({
    queryKey: ["dashboard", "me", user.id],
    queryFn: () => wdas.getPersonalDashboard(user.id),
    enabled: canFetch && !!user.id,
  });

  const volumeQ = useQuery({
    queryKey: ["reports", "volume"],
    queryFn: () => api.get<ApiVolumeTrendReportDto[]>("/api/reports/volume-trends?months=6"),
    enabled: canFetch,
  });

  const bottlenecksQ = useQuery({
    queryKey: ["reports", "bottlenecks"],
    queryFn: () => api.get<ApiBottleneckReportDto[]>("/api/reports/bottlenecks"),
    enabled: canFetch,
  });

  const metricsQ = useQuery({
    queryKey: ["reports", "success-metrics"],
    queryFn: () => api.get<ApiSuccessMetricsDto>("/api/reports/success-metrics"),
    enabled: canFetch && hasAnyRole(["dept_admin", "super_admin"]),
  });

  const pending = { data: dashboardQ.data?.pending, isLoading: dashboardQ.isLoading, isError: dashboardQ.isError, refetch: dashboardQ.refetch };
  const delegated = { data: dashboardQ.data?.delegated, isLoading: dashboardQ.isLoading };
  const mine = { data: dashboardQ.data?.mine, isLoading: dashboardQ.isLoading };
  const completed = { data: dashboardQ.data?.completed, isLoading: dashboardQ.isLoading };

  const approvalTrend = (volumeQ.data ?? []).map((v) => ({
    name: v.period,
    approvals: v.approvedCount,
    drafts: v.submittedCount,
  }));

  const workloadByTeam = (bottlenecksQ.data ?? []).slice(0, 4).map((b, i) => ({
    name: b.approverDisplayName.split(" ")[0] || `A${i + 1}`,
    value: b.stepCount,
    color: ["#d97706", "#f59e0b", "#78716c", "#292524"][i % 4],
  }));

  const onTime = pending.data?.filter((d) => d.sla === "on_time").length ?? 0;
  const atRisk = pending.data?.filter((d) => d.sla === "at_risk").length ?? 0;
  const overdue = pending.data?.filter((d) => d.sla === "overdue").length ?? 0;
  const slaTotal = onTime + atRisk + overdue || 1;
  const cycleHealth = [
    { name: "On time", value: Math.round((onTime / slaTotal) * 100), color: "#f59e0b" },
    { name: "At risk", value: Math.round((atRisk / slaTotal) * 100), color: "#a8a29e" },
    { name: "Delayed", value: Math.round((overdue / slaTotal) * 100), color: "#292524" },
  ];

  const [confirm, setConfirm] = useState<{ id: string; action: "approve" | "reject"; stepId?: string } | null>(null);

  const runAction = async (reason?: string) => {
    if (!confirm) return;
    try {
      const updated = await wdas.actOnDocument(
        confirm.id,
        confirm.action,
        reason ?? "Approved from dashboard",
        user.id,
        confirm.stepId,
      );
      await refreshWorkflowViews(qc, { userId: user.id, document: updated });
      await dashboardQ.refetch();
      setConfirm(null);
      toast.success(confirm.action === "approve" ? "Document approved" : "Document rejected");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const [subFilter, setSubFilter] = useState<import("@/lib/wdas/types").DocStatus | "all">("all");
  const myFiltered = subFilter === "all" ? mine.data ?? [] : (mine.data ?? []).filter((d) => d.status === subFilter);

  const executiveSignals = showAdminMetrics && metricsQ.data
    ? [
        { label: "SLA compliance", value: `${metricsQ.data.slaCompliancePercent}%`, tone: "text-amber-300" },
        { label: "Avg cycle time", value: `${metricsQ.data.averageCycleTimeDays}d`, tone: "text-amber-100" },
        { label: "Adoption rate", value: `${metricsQ.data.adoptionRatePercent}%`, tone: "text-stone-200" },
      ]
    : [
        { label: "Focus queue", value: `${pending.data?.length ?? 0} items`, tone: "text-amber-300" },
        { label: "Actionable drafts", value: `${(mine.data ?? []).filter((d) => d.status === "draft").length} items`, tone: "text-amber-100" },
        { label: "Closed workflows", value: `${(completed.data ?? []).filter((d) => d.status === "approved").length} items`, tone: "text-stone-200" },
      ];

  const summaryCards = [
    {
      title: "Pending reviews",
      value: pending.data?.length ?? 0,
      subtitle: "Awaiting your action",
      icon: Inbox,
      accent: "text-amber-700",
      iconClass: "border-amber-500/30 bg-amber-500/10",
      bar: "bg-amber-500",
      glow: "linear-gradient(135deg, rgba(245,158,11,0.16), rgba(28,25,23,0.04))",
    },
    {
      title: "Drafts in progress",
      value: (mine.data ?? []).filter((d) => d.status === "draft").length,
      subtitle: "Owned by you",
      icon: FileText,
      accent: "text-amber-700",
      iconClass: "border-amber-500/30 bg-amber-500/10",
      bar: "bg-amber-600",
      glow: "linear-gradient(135deg, rgba(217,119,6,0.16), rgba(28,25,23,0.04))",
    },
    {
      title: "Completed this month",
      value: (completed.data ?? []).filter((d) => d.status === "approved").length,
      subtitle: "Approved and closed",
      icon: CheckCircle2,
      accent: "text-amber-700",
      iconClass: "border-amber-500/30 bg-amber-500/10",
      bar: "bg-amber-400",
      glow: "linear-gradient(135deg, rgba(251,191,36,0.16), rgba(28,25,23,0.04))",
    },
    {
      title: "Active workflows",
      value: (mine.data ?? []).filter((d) => d.status === "pending" || d.status === "ready_to_finalize").length,
      subtitle: "Currently in review",
      icon: ShieldCheck,
      accent: "text-stone-700",
      iconClass: "border-stone-500/25 bg-stone-500/10",
      bar: "bg-stone-700",
      glow: "linear-gradient(135deg, rgba(120,113,108,0.16), rgba(28,25,23,0.04))",
    },
  ];

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${user.name.split(" ")[0]}`}
        subtitle="Your approvals, drafts, and recently completed documents."
      />
      <DelegationBanner />
      <div className="page-shell">
        <section className="relative overflow-hidden rounded-[30px] border border-stone-800 bg-stone-950 p-4 text-white shadow-[0_25px_70px_-35px_rgba(28,25,23,0.8)] sm:p-5">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-amber-400/20 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-44 w-44 rounded-full bg-amber-700/10 blur-3xl" />
          <div className="relative z-10">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="max-w-2xl">
                <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">
                  <Sparkles className="h-3.5 w-3.5" />
                  Executive command center
                </span>
                <p className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Operations overview</p>
                <p className="mt-1 text-sm text-slate-200">Executive signals and live workflow health in one polished, fast-moving workspace.</p>
              </div>
              <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-slate-100">
                {showAdminMetrics ? (
                  <Link to="/dashboard/department" className="hover:text-white">Department view →</Link>
                ) : "Separate analytics view"}
              </div>
            </div>

            <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {executiveSignals.map((signal) => (
                <div key={signal.label} className="rounded-2xl border border-white/10 bg-white/8 px-3 py-3 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-300">{signal.label}</p>
                  <p className={cn("mt-2 text-2xl font-semibold tracking-tight", signal.tone)}>{signal.value}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {summaryCards.map((card) => {
                const Icon = card.icon;
                const fillWidth = Math.min(100, Math.max(18, card.value * 12));
                return (
                  <Card
                    key={card.title}
                    className="dashboard-animated-card group relative overflow-hidden border-white/15 bg-white/5 text-white shadow-[0_15px_45px_-24px_rgba(15,23,42,0.7)]"
                    style={{ backgroundImage: card.glow }}
                  >
                    <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0))]" />
                    <div className="relative z-10 flex items-start justify-between p-5">
                      <div>
                        <p className="text-sm font-medium text-slate-200">{card.title}</p>
                        <p className="mt-2 text-3xl font-semibold tracking-tight text-white">{card.value}</p>
                        <p className="mt-1 text-sm text-slate-300">{card.subtitle}</p>
                      </div>
                      <div className={cn("rounded-xl border p-2.5 shadow-sm", card.iconClass, card.accent)}>
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>
                    <div className="relative z-10 h-1 w-full bg-white/10">
                      <div className={cn("h-1 transition-all duration-500", card.bar)} style={{ width: `${fillWidth}%` }} />
                    </div>
                    <div className="relative z-10 flex items-center gap-2 px-5 py-3 text-sm text-slate-200">
                      <TrendingUp className="h-4 w-4 text-amber-300" />
                      <span>Steady throughput across this week</span>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-border/60 bg-background/70 p-4 shadow-[0_12px_40px_-24px_rgba(15,23,42,0.22)] backdrop-blur sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Operations overview</p>
              <p className="text-sm text-muted-foreground">Executive signals and live workflow health.</p>
            </div>
            <div className="rounded-full border border-border/70 bg-muted/70 px-3 py-1 text-xs font-medium text-muted-foreground">
              {showAdminMetrics ? (
                <Link to="/dashboard/department" className="hover:text-foreground">Department view →</Link>
              ) : "Separate analytics view"}
            </div>
          </div>
          {metricsQ.data && showAdminMetrics && (
            <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border bg-card/80 p-3">
                <p className="text-xs text-muted-foreground">Avg cycle time</p>
                <p className="text-xl font-semibold">{metricsQ.data.averageCycleTimeDays}d</p>
              </div>
              <div className="rounded-xl border bg-card/80 p-3">
                <p className="text-xs text-muted-foreground">Adoption (30d)</p>
                <p className="text-xl font-semibold">{metricsQ.data.adoptionRatePercent}%</p>
              </div>
              <div className="rounded-xl border bg-card/80 p-3">
                <p className="text-xs text-muted-foreground">SLA compliance</p>
                <p className="text-xl font-semibold">{metricsQ.data.slaCompliancePercent}%</p>
              </div>
              <div className="rounded-xl border bg-card/80 p-3">
                <p className="text-xs text-muted-foreground">SLA breaches</p>
                <p className="text-xl font-semibold">{metricsQ.data.slaBreachCount}</p>
              </div>
            </div>
          )}
          <div className="grid gap-4 lg:grid-cols-3">
          <Card className="dashboard-animated-card mt-4 border-amber-300/60 bg-amber-50/70 shadow-[0_20px_60px_-28px_rgba(217,119,6,0.25)]">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-xl border border-amber-300 bg-amber-100 p-2.5 text-amber-800">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Governance and process visibility</p>
                <p className="mt-1 text-sm text-muted-foreground">Every approval remains traceable, secure, and easy to review from a single workspace.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1.5 text-sm text-muted-foreground">
              <Clock3 className="h-4 w-4" />
              <span>Updated in real time</span>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
          <Card className="dashboard-chart-panel dashboard-animated-card overflow-hidden border-amber-200/70 bg-amber-50/45">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.14),_transparent_35%)]" />
            <CardHeader className="relative z-10 flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4 text-amber-700" /> Approval momentum
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">A premium view of approvals, drafts, and response velocity.</p>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-amber-300 bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800">
                <Sparkles className="h-3.5 w-3.5" /> Live pulse
              </div>
            </CardHeader>
            <CardContent className="relative z-10 h-[300px] p-0 px-5 pb-5">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={approvalTrend.length ? approvalTrend : [{ name: "—", approvals: 0, drafts: 0 }]}>
                  <defs>
                    <linearGradient id="approvalFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.38} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(148,163,184,0.16)" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                  <Tooltip
                    cursor={{ stroke: "rgba(217,119,6,0.25)", strokeWidth: 2 }}
                    contentStyle={{ borderRadius: 14, borderColor: "rgba(148,163,184,0.25)", boxShadow: "0 20px 45px -24px rgba(15,23,42,0.3)" }}
                  />
                  <Area type="monotone" dataKey="approvals" stroke="#d97706" strokeWidth={3} fill="url(#approvalFill)" />
                  <Area type="monotone" dataKey="drafts" stroke="#292524" strokeWidth={3} fill="transparent" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            <Card className="dashboard-animated-card border-amber-200/70 bg-amber-50/35">
              <CardHeader className="space-y-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-4 w-4 text-amber-700" /> Departments
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[140px] p-0 px-5 pb-5">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={workloadByTeam.length ? workloadByTeam : [{ name: "—", value: 0, color: "#d97706" }]}>
                    <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.16)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                    <Tooltip cursor={{ fill: "rgba(15,23,42,0.03)" }} contentStyle={{ borderRadius: 12, borderColor: "rgba(148,163,184,0.24)" }} />
                    <Bar dataKey="value" radius={[8, 8, 4, 4]} animationDuration={900}>
                      {workloadByTeam.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="dashboard-animated-card border-amber-200/70 bg-amber-50/35">
              <CardHeader className="space-y-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckCircle2 className="h-4 w-4 text-amber-500" /> Cycle health
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[140px] p-0 px-5 pb-5">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={cycleHealth} dataKey="value" innerRadius={38} outerRadius={58} paddingAngle={3} animationDuration={900}>
                      {cycleHealth.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, borderColor: "rgba(148,163,184,0.24)" }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

        </section>

        <section className="rounded-[28px] border border-border/60 bg-background/70 p-4 shadow-[0_12px_40px_-24px_rgba(15,23,42,0.2)] backdrop-blur sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Workflow queues</p>
              <p className="text-sm text-muted-foreground">Action-oriented records and review lists.</p>
            </div>
            <div className="rounded-full border border-border/70 bg-muted/70 px-3 py-1 text-xs font-medium text-muted-foreground">
              Separate records view
            </div>
          </div>

          {hasAnyRole(["approver", "dept_admin"]) && (
            <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Inbox className="h-4 w-4 text-info" /> Pending my approval
                <Badge variant="secondary">{pending.data?.length ?? 0}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {pending.isLoading ? <LoadingState /> :
                pending.isError ? <ErrorState message="Could not load approvals." onRetry={() => pending.refetch()} /> :
                !pending.data?.length ? <EmptyState icon={<Inbox className="h-8 w-8" />} title="No documents awaiting your approval" description="You're all caught up." /> :
                <DocumentTable
                  docs={pending.data}
                  showActions="approver"
                  onApprove={(id) => setConfirm({ id, action: "approve", stepId: pending.data?.find((d) => d.id === id)?.currentStepId })}
                  onReject={(id) => setConfirm({ id, action: "reject", stepId: pending.data?.find((d) => d.id === id)?.currentStepId })}
                />}
            </CardContent>
          </Card>
        )}

          {(delegated.data?.length ?? 0) > 0 && (
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  <UserCheck className="h-4 w-4 text-warning" /> Delegated to you
                  <Badge variant="secondary">{delegated.data?.length ?? 0}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {delegated.isLoading ? <LoadingState /> :
                  <DocumentTable
                    docs={delegated.data ?? []}
                    showActions="approver"
                    onApprove={(id) => setConfirm({ id, action: "approve", stepId: delegated.data?.find((d) => d.id === id)?.currentStepId })}
                    onReject={(id) => setConfirm({ id, action: "reject", stepId: delegated.data?.find((d) => d.id === id)?.currentStepId })}
                  />}
              </CardContent>
            </Card>
          )}

        {hasAnyRole(["owner"]) && (
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-primary" /> My documents
                <Badge variant="secondary">{mine.data?.length ?? 0}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="flex flex-wrap gap-1 border-b px-4 py-2">
                {(["all","draft","pending","ready_to_finalize","approved","rejected","returned","cancelled"] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => setSubFilter(k)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                      subFilter === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {k === "all" ? "All" : k === "pending" ? "In Progress" : k === "ready_to_finalize" ? "Ready" : k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, " ")}
                  </button>
                ))}
              </div>
              {mine.isLoading ? <LoadingState /> :
                !myFiltered.length ? <EmptyState title="No documents in this view" /> :
                <DocumentTable docs={myFiltered} showStatus />}
            </CardContent>
          </Card>
        )}

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-4 w-4 text-success" /> Recently completed
                <Badge variant="secondary">{completed.data?.length ?? 0}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {completed.isLoading ? <LoadingState /> :
                !completed.data?.length ? <EmptyState title="Nothing completed yet" /> :
                <DocumentTable docs={completed.data.slice(0, 8)} showStatus />}
            </CardContent>
          </Card>
        </section>
        {showAdminMetrics && <AdminConfigAnalytics />}
      </div>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm?.action === "approve" ? "Approve document?" : "Reject document?"}
        description={confirm?.action === "approve"
          ? "This will move the document to the next approver or finalize it."
          : "This will reject the document and notify the owner."}
        confirmLabel={confirm?.action === "approve" ? "Approve" : "Reject"}
        variant={confirm?.action === "approve" ? "success" : "destructive"}
        requireReason={confirm?.action === "reject"}
        onConfirm={runAction}
      />
    </div>
  );
}
