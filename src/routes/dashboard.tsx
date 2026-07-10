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
import { isAdminRole } from "@/lib/wdas/role-context";
import { Building2, FileType, GitBranch, Mail, Network, UserPlus, Workflow as WorkflowIcon } from "lucide-react";
import { useCanFetchDocuments } from "@/lib/wdas/use-document-query";
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

  const configLinks = [
    { to: "/config/users", label: "Users", description: "Create and manage user accounts and roles", icon: UserPlus },
    { to: "/config/departments", label: "Departments", description: "Organize teams and routing boundaries", icon: Building2 },
    { to: "/config/workflows", label: "Workflows", description: "Configure approval paths and rules", icon: WorkflowIcon },
    { to: "/config/document-types", label: "Document types", description: "Define reusable document categories", icon: FileType },
    { to: "/config/approval-modes", label: "Approval modes", description: "Reference for matrix, user, and hybrid routing", icon: GitBranch },
    { to: "/config/external-approvers", label: "External approvers", description: "Manage guest approval sessions", icon: Mail },
    { to: "/config/active-directory", label: "Active Directory", description: "Directory connection settings", icon: Network },
    { to: "/settings/delegation", label: "Delegation", description: "Approver delegation policies", icon: UserPlus },
  ] as const;

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user.name.split(" ")[0]}`}
        subtitle="Super Admin workspace — manage system configuration from here."
      />
      <div className="page-shell">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {configLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to}>
                <Card className="h-full border-border/70 transition-colors hover:border-primary/30 hover:bg-muted/30">
                  <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-2">
                    <div className="rounded-lg border border-primary/15 bg-primary/10 p-2 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{item.label}</CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </section>
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
    color: ["#2563eb", "#8b5cf6", "#14b8a6", "#f59e0b"][i % 4],
  }));

  const onTime = pending.data?.filter((d) => d.sla === "on_time").length ?? 0;
  const atRisk = pending.data?.filter((d) => d.sla === "at_risk").length ?? 0;
  const overdue = pending.data?.filter((d) => d.sla === "overdue").length ?? 0;
  const slaTotal = onTime + atRisk + overdue || 1;
  const cycleHealth = [
    { name: "On time", value: Math.round((onTime / slaTotal) * 100), color: "#2563eb" },
    { name: "At risk", value: Math.round((atRisk / slaTotal) * 100), color: "#8b5cf6" },
    { name: "Delayed", value: Math.round((overdue / slaTotal) * 100), color: "#f97316" },
  ];

  const [confirm, setConfirm] = useState<{ id: string; action: "approve" | "reject" } | null>(null);

  const runAction = async (reason?: string) => {
    if (!confirm) return;
    try {
      await wdas.actOnDocument(confirm.id, confirm.action, reason ?? "Approved from dashboard", user.id);
      toast.success(confirm.action === "approve" ? "Document approved" : "Document rejected");
      qc.invalidateQueries();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const [subFilter, setSubFilter] = useState<import("@/lib/wdas/types").DocStatus | "all">("all");
  const myFiltered = subFilter === "all" ? mine.data ?? [] : (mine.data ?? []).filter((d) => d.status === subFilter);

  const summaryCards = [
    {
      title: "Pending reviews",
      value: pending.data?.length ?? 0,
      subtitle: "Awaiting your action",
      icon: Inbox,
      accent: "text-info",
      bar: "bg-info",
    },
    {
      title: "Drafts in progress",
      value: (mine.data ?? []).filter((d) => d.status === "draft").length,
      subtitle: "Owned by you",
      icon: FileText,
      accent: "text-primary",
      bar: "bg-primary",
    },
    {
      title: "Completed this month",
      value: (completed.data ?? []).filter((d) => d.status === "approved").length,
      subtitle: "Approved and closed",
      icon: CheckCircle2,
      accent: "text-success",
      bar: "bg-success",
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
            {summaryCards.map((card) => {
              const Icon = card.icon;
              return (
                <Card key={card.title} className="dashboard-animated-card group relative overflow-hidden border-border/70 bg-gradient-to-br from-white via-card to-background/90">
                <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-gradient-to-br from-primary/15 to-transparent blur-2xl" />
                <div className="flex items-start justify-between p-5">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{card.value}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{card.subtitle}</p>
                  </div>
                  <div className={cn("rounded-xl border border-border/70 bg-card p-2.5 shadow-sm", card.accent)}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                <div className="h-1 w-full bg-muted/80">
                  <div className={cn("h-1 transition-all duration-500", card.bar)} style={{ width: `${Math.min(100, Math.max(18, card.value * 12))}%` }} />
                </div>
                <div className="flex items-center gap-2 px-5 py-3 text-sm text-muted-foreground">
                  <TrendingUp className="h-4 w-4 text-success" />
                  <span>Steady throughput across this week</span>
                </div>
              </Card>
            );
          })}
          </div>
          <Card className="dashboard-animated-card mt-4 border-primary/15 bg-gradient-to-br from-primary/10 via-card to-background/95 shadow-[0_20px_60px_-28px_rgba(37,99,235,0.35)]">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-xl border border-primary/20 bg-primary/10 p-2.5 text-primary">
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
          <Card className="dashboard-chart-panel dashboard-animated-card overflow-hidden border-border/70 bg-gradient-to-br from-white via-slate-50 to-blue-50/70">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.16),_transparent_35%)]" />
            <CardHeader className="relative z-10 flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4 text-primary" /> Approval momentum
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">A premium view of approvals, drafts, and response velocity.</p>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
                <Sparkles className="h-3.5 w-3.5" /> Live pulse
              </div>
            </CardHeader>
            <CardContent className="relative z-10 h-[300px] p-0 px-5 pb-5">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={approvalTrend.length ? approvalTrend : [{ name: "—", approvals: 0, drafts: 0 }]}>
                  <defs>
                    <linearGradient id="approvalFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.38} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(148,163,184,0.16)" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                  <Tooltip
                    cursor={{ stroke: "rgba(37,99,235,0.2)", strokeWidth: 2 }}
                    contentStyle={{ borderRadius: 14, borderColor: "rgba(148,163,184,0.25)", boxShadow: "0 20px 45px -24px rgba(15,23,42,0.3)" }}
                  />
                  <Area type="monotone" dataKey="approvals" stroke="#2563eb" strokeWidth={3} fill="url(#approvalFill)" />
                  <Area type="monotone" dataKey="drafts" stroke="#8b5cf6" strokeWidth={3} fill="transparent" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            <Card className="dashboard-animated-card border-border/70 bg-gradient-to-br from-white via-slate-50/80 to-violet-50/70">
              <CardHeader className="space-y-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-4 w-4 text-violet-500" /> Throughput by team
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[140px] p-0 px-5 pb-5">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={workloadByTeam.length ? workloadByTeam : [{ name: "—", value: 0, color: "#2563eb" }]}>
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

            <Card className="dashboard-animated-card border-border/70 bg-gradient-to-br from-white via-slate-50/80 to-amber-50/70">
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
                  onApprove={(id) => setConfirm({ id, action: "approve" })}
                  onReject={(id) => setConfirm({ id, action: "reject" })}
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
                    onApprove={(id) => setConfirm({ id, action: "approve" })}
                    onReject={(id) => setConfirm({ id, action: "reject" })}
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
