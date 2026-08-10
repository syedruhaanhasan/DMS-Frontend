import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Activity,
  Archive,
  BadgeCheck,
  Bot,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Database,
  FileSearch,
  FileText,
  FolderPlus,
  HardDrive,
  Inbox,
  Link2Off,
  Mail,
  ScanLine,
  Server,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Timer,
  TrendingUp,
  Upload,
  UserPlus,
  Users,
  XCircle,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/wdas/confirm-dialog";
import { DelegationBanner } from "@/components/wdas/delegation-banner";
import { useSession } from "@/lib/wdas/role-context";
import { useCanFetchDocuments } from "@/lib/wdas/use-document-query";
import { refreshWorkflowViews } from "@/lib/wdas/refresh-workflow-queries";
import { parseApiDate, relTime } from "@/lib/wdas/format";
import { wdas } from "@/services/wdas";
import { api } from "@/lib/api/client";
import type { ApiBottleneckReportDto, ApiSuccessMetricsDto, ApiVolumeTrendReportDto } from "@/lib/api/types";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
});

const YELLOW = "#FFC107";
const GOLD = "#FFD54F";
const SUCCESS = "#00E676";
const WARNING = "#FFB300";
const DANGER = "#FF5252";
const INFO = "#29B6F6";
const MUTED = "var(--vf-muted)";
const GRID = "var(--vf-border)";

const SAMPLE_UPLOADS = [
  { name: "Jan", value: 420 },
  { name: "Feb", value: 510 },
  { name: "Mar", value: 480 },
  { name: "Apr", value: 620 },
  { name: "May", value: 710 },
  { name: "Jun", value: 860 },
];

const SAMPLE_WORKFLOW = [
  { name: "Jan", submitted: 180, review: 120, approved: 140, rejected: 18 },
  { name: "Feb", submitted: 210, review: 150, approved: 160, rejected: 22 },
  { name: "Mar", submitted: 240, review: 170, approved: 190, rejected: 20 },
  { name: "Apr", submitted: 280, review: 200, approved: 220, rejected: 28 },
  { name: "May", submitted: 310, review: 230, approved: 260, rejected: 24 },
  { name: "Jun", submitted: 340, review: 250, approved: 290, rejected: 30 },
];

const SAMPLE_DEPTS = [
  { name: "Finance", value: 92 },
  { name: "Legal", value: 78 },
  { name: "HR", value: 64 },
  { name: "IT", value: 58 },
  { name: "Sales", value: 51 },
  { name: "Operations", value: 44 },
];

const SAMPLE_CATEGORIES = [
  { name: "Contracts", value: 32, color: YELLOW },
  { name: "Invoices", value: 24, color: GOLD },
  { name: "Policies", value: 18, color: INFO },
  { name: "Reports", value: 16, color: SUCCESS },
  { name: "Certificates", value: 10, color: WARNING },
];

const ACTIVITY_SEED = [
  { icon: Upload, color: INFO, text: "Sarah uploaded Contract.pdf", time: "2m ago" },
  { icon: CheckCircle2, color: SUCCESS, text: "Ahmed approved Invoice #4821", time: "14m ago" },
  { icon: Bot, color: YELLOW, text: "AI flagged a duplicate file in Finance", time: "31m ago" },
  { icon: ShieldCheck, color: GOLD, text: "Compliance report generated", time: "1h ago" },
  { icon: Archive, color: MUTED, text: "Q1 policies archived", time: "2h ago" },
];

const QUICK_ACTIONS = [
  { label: "Upload Document", icon: Upload, to: "/documents/new" },
 
  { label: "Request Approval", icon: Inbox, to: "/inbox" },
 

  { label: "Reports", icon: FileSearch, to: "/reports" },
  { label: "History", icon: Archive, to: "/repository" },

];

function Dashboard() {
  return <VeriFlowDashboard />;
}

function VeriFlowDashboard() {
  const { user } = useSession();
  const qc = useQueryClient();
  const canFetch = useCanFetchDocuments();
  const [now, setNow] = useState(() => new Date());
  const [confirm, setConfirm] = useState<{ id: string; action: "approve" | "reject"; stepId?: string } | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const dashboardQ = useQuery({
    queryKey: ["dashboard", "me", user.id],
    queryFn: () => wdas.getPersonalDashboard(user.id),
    enabled: canFetch && !!user.id,
    refetchInterval: 30_000,
  });

  const volumeQ = useQuery({
    queryKey: ["reports", "volume"],
    queryFn: () => api.get<ApiVolumeTrendReportDto[]>("/api/reports/volume-trends?months=6"),
    enabled: canFetch,
    refetchInterval: 60_000,
  });

  const bottlenecksQ = useQuery({
    queryKey: ["reports", "bottlenecks"],
    queryFn: () => api.get<ApiBottleneckReportDto[]>("/api/reports/bottlenecks"),
    enabled: canFetch,
    refetchInterval: 60_000,
  });

  const metricsQ = useQuery({
    queryKey: ["reports", "success-metrics"],
    queryFn: () => api.get<ApiSuccessMetricsDto>("/api/reports/success-metrics"),
    enabled: canFetch,
    refetchInterval: 60_000,
  });

  const historyQ = useQuery({
    queryKey: ["docs", "repository"],
    queryFn: () => wdas.listRepositoryDocuments(),
    enabled: canFetch,
    refetchInterval: 60_000,
  });

  const pending = dashboardQ.data?.pending ?? [];
  const delegated = dashboardQ.data?.delegated ?? [];
  const mine = dashboardQ.data?.mine ?? [];
  const completed = dashboardQ.data?.completed ?? [];
  const historyDocs = historyQ.data ?? [];
  const approvalQueue = [...pending, ...delegated];

  const greeting = useMemo(() => {
    const h = now.getHours();
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    return "Good Evening";
  }, [now]);

  const volume = volumeQ.data ?? [];
  const uploads = volume.length
    ? volume.map((v) => ({ name: v.period, value: v.submittedCount }))
    : SAMPLE_UPLOADS;
  const workflow = volume.length
    ? volume.map((v) => ({
        name: v.period,
        submitted: v.submittedCount,
        review: Math.max(0, v.submittedCount - v.approvedCount - v.rejectedCount),
        approved: v.approvedCount,
        rejected: v.rejectedCount,
      }))
    : SAMPLE_WORKFLOW;
  const departments =
    bottlenecksQ.data && bottlenecksQ.data.length
      ? bottlenecksQ.data.slice(0, 6).map((b) => ({
          name: b.approverDisplayName.split(" ")[0] || "Team",
          value: b.stepCount,
        }))
      : SAMPLE_DEPTS;

  const isSameDay = (iso?: string) => {
    if (!iso) return false;
    const d = parseApiDate(iso);
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  };

  const totalDocs = useMemo(() => {
    const ids = new Set<string>();
    for (const doc of [...mine, ...completed, ...pending, ...delegated, ...historyDocs]) {
      ids.add(doc.id);
    }
    return ids.size;
  }, [mine, completed, pending, delegated, historyDocs]);

  const approvedToday = completed.filter(
    (d) => d.status === "approved" && isSameDay(d.finalizedAt ?? d.submittedAt ?? d.createdAt),
  ).length;

  const rejectedCount = useMemo(() => {
    const ids = new Set<string>();
    for (const d of [...completed, ...mine, ...historyDocs]) {
      if (d.status === "rejected") ids.add(d.id);
    }
    return ids.size;
  }, [completed, mine, historyDocs]);

  const atRiskCount = approvalQueue.filter((d) => d.sla === "overdue" || d.sla === "at_risk").length;

  const compliance = useMemo(() => {
    if (metricsQ.data?.slaCompliancePercent != null) return metricsQ.data.slaCompliancePercent;
    if (!approvalQueue.length) return 100;
    const onTime = approvalQueue.filter((d) => d.sla === "on_time").length;
    return Math.round((onTime / approvalQueue.length) * 100);
  }, [metricsQ.data?.slaCompliancePercent, approvalQueue]);

  const volumeGrowth = useMemo(() => {
    if (volume.length < 2) return null;
    const prev = volume[volume.length - 2]?.submittedCount ?? 0;
    const curr = volume[volume.length - 1]?.submittedCount ?? 0;
    if (prev <= 0) return curr > 0 ? "+100%" : "0%";
    const pct = Math.round(((curr - prev) / prev) * 100);
    return `${pct >= 0 ? "+" : ""}${pct}%`;
  }, [volume]);

  const storagePct = Math.min(
    100,
    Math.max(4, Math.round((totalDocs / Math.max(totalDocs + 25, 100)) * 100)),
  );

  const kpis = [
    {
      label: "Total Documents",
      value: totalDocs,
      hint: volumeGrowth ? `${volumeGrowth} vs last period` : "In your scope",
      tone: YELLOW,
      icon: FileText,
      spark: volume.length ? uploads.slice(-6).map((u) => u.value) : undefined,
    },
    {
      label: "Pending Approval",
      value: approvalQueue.length,
      hint: approvalQueue.length ? "Needs attention" : "All clear",
      tone: YELLOW,
      icon: Inbox,
    },
    {
      label: "Approved Today",
      value: approvedToday,
      hint: "Closed today",
      tone: SUCCESS,
      icon: CheckCircle2,
    },
    {
      label: "Rejected",
      value: rejectedCount,
      hint: "In history",
      tone: DANGER,
      icon: XCircle,
    },
    {
      label: "At Risk / Overdue",
      value: atRiskCount,
      hint: "SLA watch",
      tone: WARNING,
      icon: Timer,
    },
    {
      label: "Compliance Score",
      value: compliance,
      hint: metricsQ.data ? "SLA compliance" : "From open queue",
      tone: SUCCESS,
      icon: ShieldCheck,
      ring: true,
    },
  ];

  const runAction = async (reason?: string) => {
    if (!confirm) return;
    const note = reason?.trim();
    if (!note) {
      toast.error("A comment is required before you can approve or reject.");
      return;
    }
    try {
      const updated = await wdas.actOnDocument(
        confirm.id,
        confirm.action,
        note,
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

  const firstName = user.name.split(" ")[0] || "there";

  return (
    <div className="vf-dashboard">
      <DelegationBanner />
      <div className="vf-shell">
        <div className="vf-ambient vf-ambient-a" aria-hidden />
        <div className="vf-ambient vf-ambient-b" aria-hidden />
        <div className="vf-ambient vf-ambient-c" aria-hidden />

        {/* SECTION 1 — Hero */}
        <section className="vf-card vf-reveal vf-hero-shimmer vf-card-shine relative overflow-hidden p-6 sm:p-8">
          <div className="vf-hero-glow pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-[#FFC107]/10 blur-3xl" />
          <div className="vf-hero-glow pointer-events-none absolute bottom-0 left-1/3 h-40 w-40 rounded-full bg-[#FFD54F]/5 blur-3xl" style={{ animationDelay: "1.2s" }} />
          <div className="relative z-10 grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
            <div>
              <p className="vf-chip-in vf-yellow text-sm font-medium tracking-[0.18em] uppercase">{greeting},</p>
              <h1 className="vf-chip-in mt-2 text-3xl font-bold tracking-tight vf-text sm:text-4xl" style={{ animationDelay: "80ms" }}>{firstName}</h1>
              <p className="vf-chip-in mt-3 max-w-xl text-base vf-muted" style={{ animationDelay: "140ms" }}>
                Everything is flowing smoothly today.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {[
                  { icon: CalendarDays, label: format(now, "EEEE, MMM d") },
                  { icon: Clock3, label: format(now, "h:mm a") },
                  { icon: ShieldCheck, label: "System Healthy", accent: true },
                  { icon: Bot, label: "AI Online", accent: true },
                  { icon: HardDrive, label: `Storage ${storagePct}%` },
                ].map((chip, i) => (
                  <span key={chip.label} className="vf-chip-in" style={{ animationDelay: `${180 + i * 60}ms` }}>
                    <MetaChip icon={chip.icon} accent={chip.accent}>{chip.label}</MetaChip>
                  </span>
                ))}
              </div>
            </div>
            <div className="vf-slide-right flex items-center justify-center lg:justify-end" style={{ animationDelay: "160ms" }}>
              <div className="vf-orb vf-pulse vf-scan relative flex h-28 w-28 items-center justify-center rounded-full border border-[#FFC107]/30 bg-[#FFC107]/10 vf-glow">
                <BadgeCheck className="vf-soft-bob h-12 w-12 text-[#FFC107]" />
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2 — KPIs */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {kpis.map((kpi, i) => {
            const Icon = kpi.icon;
            return (
              <article
                key={kpi.label}
                className="vf-card vf-lift vf-reveal vf-card-shine p-5"
                style={{ animationDelay: `${120 + i * 70}ms` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium tracking-[0.14em] vf-muted uppercase">{kpi.label}</p>
                    <p className="mt-2 text-3xl font-extrabold tabular-nums tracking-tight vf-text">
                      <AnimatedNumber value={kpi.value} suffix={kpi.ring ? "%" : ""} />
                    </p>
                    <p className="mt-1 text-xs font-medium" style={{ color: kpi.tone }}>
                      {kpi.hint}
                    </p>
                  </div>
                  <div
                    className="vf-kpi-icon vf-icon-pop rounded-2xl border border-[color:var(--vf-border)] p-2.5"
                    style={{ background: `${kpi.tone}18`, color: kpi.tone, animationDelay: `${180 + i * 70}ms` }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                {kpi.spark && (
                  <div className="mt-4 h-10">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={kpi.spark.map((v, idx) => ({ i: idx, v }))}>
                        <Line type="monotone" dataKey="v" stroke={YELLOW} strokeWidth={2} dot={false} isAnimationActive animationDuration={1100} animationBegin={200 + i * 80} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {kpi.ring && (
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-[color:color-mix(in_oklab,var(--vf-text)_8%,transparent)]">
                    <div
                      className="vf-bar-fill h-full rounded-full bg-[#00E676]"
                      style={{ width: `${Math.min(100, kpi.value)}%`, animationDelay: `${280 + i * 70}ms` }}
                    />
                  </div>
                )}
              </article>
            );
          })}
        </section>

        {/* SECTION 3 — Analytics */}
        <section className="grid gap-4 xl:grid-cols-12">
          <ChartCard title="Document Categories" subtitle="Distribution" className="xl:col-span-5" chartHeight={220} delay={180}>
            <div className="flex h-full flex-col justify-start">
              <div className="h-[180px] w-full shrink-0">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <Pie data={SAMPLE_CATEGORIES} dataKey="value" innerRadius={52} outerRadius={78} paddingAngle={3} cy="48%" isAnimationActive animationDuration={1000} animationBegin={220}>
                      {SAMPLE_CATEGORIES.map((c) => (
                        <Cell key={c.name} fill={c.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-1 flex flex-wrap justify-center gap-3 px-2">
                {SAMPLE_CATEGORIES.map((c, i) => (
                  <span
                    key={c.name}
                    className="vf-chip-in flex items-center gap-1.5 text-[11px] vf-muted"
                    style={{ animationDelay: `${320 + i * 60}ms` }}
                  >
                    <span className="vf-dot-blink h-2 w-2 rounded-full" style={{ background: c.color, animationDelay: `${i * 200}ms` }} />
                    {c.name}
                  </span>
                ))}
              </div>
            </div>
          </ChartCard>

          <ChartCard title="Storage" subtitle="Consumption" className="xl:col-span-4" delay={240}>
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                innerRadius="68%"
                outerRadius="100%"
                data={[{ name: "used", value: storagePct, fill: YELLOW }]}
                startAngle={90}
                endAngle={-270}
              >
                <RadialBar background={{ fill: "color-mix(in oklab, var(--vf-text) 8%, transparent)" }} dataKey="value" cornerRadius={12} isAnimationActive animationDuration={1100} animationBegin={280} />
                <text x="50%" y="48%" textAnchor="middle" fill="var(--vf-text)" fontSize="28" fontWeight={800}>
                  {storagePct}%
                </text>
                <text x="50%" y="60%" textAnchor="middle" fill={MUTED} fontSize="12">
                  used
                </text>
              </RadialBarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Document Lifecycle" subtitle="Funnel" className="xl:col-span-3" delay={300}>
            <div className="flex h-full flex-col justify-center gap-3 px-1">
              {[
                { label: "Uploaded", pct: 100, color: INFO },
                { label: "Reviewed", pct: 78, color: YELLOW },
                { label: "Approved", pct: 61, color: SUCCESS },
                { label: "Archived", pct: 44, color: GOLD },
              ].map((row, index) => (
                <div key={row.label}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="vf-muted">{row.label}</span>
                    <span className="font-semibold vf-text">{row.pct}%</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-[color:color-mix(in_oklab,var(--vf-text)_8%,transparent)]">
                    <div className="vf-bar-fill h-full rounded-full" style={{ width: `${row.pct}%`, background: row.color, animationDelay: `${index * 90}ms` }} />
                  </div>
                </div>
              ))}
            </div>
          </ChartCard>

          <ChartCard title="Documents Uploaded" subtitle="Monthly trend" className="xl:col-span-4" delay={340}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={uploads}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="value" stroke={YELLOW} strokeWidth={3} dot={false} isAnimationActive animationDuration={1100} animationBegin={360} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Approval Workflow" subtitle="Submitted · Review · Approved · Rejected" className="xl:col-span-5" delay={400}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={workflow}>
                <defs>
                  <linearGradient id="vfApproved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={SUCCESS} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={SUCCESS} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="vfReview" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={YELLOW} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={YELLOW} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="submitted" stackId="1" stroke={INFO} fill={`${INFO}22`} isAnimationActive animationDuration={1100} animationBegin={420} />
                <Area type="monotone" dataKey="review" stackId="1" stroke={YELLOW} fill="url(#vfReview)" isAnimationActive animationDuration={1100} animationBegin={460} />
                <Area type="monotone" dataKey="approved" stackId="1" stroke={SUCCESS} fill="url(#vfApproved)" isAnimationActive animationDuration={1100} animationBegin={500} />
                <Area type="monotone" dataKey="rejected" stackId="1" stroke={DANGER} fill={`${DANGER}22`} isAnimationActive animationDuration={1100} animationBegin={540} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Department Activity" subtitle="Most active teams" className="xl:col-span-3" delay={460}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={departments} layout="vertical" margin={{ left: 8, top: 0 }}>
                <CartesianGrid stroke={GRID} horizontal={false} />
                <XAxis type="number" tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={72} tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,193,7,0.06)" }} />
                <Bar dataKey="value" radius={[0, 10, 10, 0]} fill={YELLOW} isAnimationActive animationDuration={1000} animationBegin={500} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </section>

        {/* SECTION 4 — Quick Actions */}
        <section className="vf-reveal" style={{ animationDelay: "280ms" }}>
          <SectionHeading title="Quick Actions" subtitle="Jump into the most common workflows" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            {QUICK_ACTIONS.map((action, i) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.label}
                  to={action.to}
                  className="vf-card vf-lift vf-chip-in vf-card-shine flex items-center gap-3 p-4 text-sm font-medium vf-text"
                  style={{ animationDelay: `${320 + i * 70}ms` }}
                >
                  <span className="vf-action-icon rounded-xl border border-[#FFC107]/25 bg-[#FFC107]/10 p-2.5 text-[#FFC107]">
                    <Icon className="h-4 w-4" />
                  </span>
                  {action.label}
                </Link>
              );
            })}
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-12">
          {/* SECTION 5 — Activity */}
          <section className="vf-card vf-slide-left vf-card-shine p-5 xl:col-span-4" style={{ animationDelay: "360ms" }}>
            <SectionHeading title="Recent Activity" subtitle="Live timeline" />
            <ol className="mt-5 space-y-4">
              {ACTIVITY_SEED.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <li key={idx} className="vf-chip-in flex gap-3" style={{ animationDelay: `${420 + idx * 80}ms` }}>
                    <span
                      className="vf-soft-bob mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--vf-border)]"
                      style={{ color: item.color, background: `${item.color}18`, animationDelay: `${idx * 0.35}s` }}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm vf-text">{item.text}</p>
                      <p className="mt-0.5 text-xs vf-muted">{item.time}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          {/* SECTION 6 — Pending table */}
          <section className="vf-card vf-reveal vf-card-shine overflow-hidden xl:col-span-8" style={{ animationDelay: "420ms" }}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b vf-hairline px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold vf-text">Pending Approval</h2>
                  {!!approvalQueue.length && (
                    <span className="vf-live-dot inline-flex h-2 w-2 rounded-full bg-[#FFC107]" />
                  )}
                </div>
                <p className="text-sm vf-muted">Documents that need your action</p>
              </div>
              <Button asChild size="sm" className="bg-[#FFC107] font-semibold text-[#0D0D0D] hover:bg-[#FFD54F]">
                <Link to="/inbox">Open Approval Box</Link>
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b vf-hairline text-[11px] tracking-[0.12em] vf-muted uppercase">
                    <th className="px-5 py-3 font-medium">Document</th>
                    <th className="px-3 py-3 font-medium">Owner</th>
                    <th className="px-3 py-3 font-medium">Priority</th>
                    <th className="px-3 py-3 font-medium">Submitted</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardQ.isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center vf-muted">
                        Loading queue…
                      </td>
                    </tr>
                  ) : !approvalQueue.length ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center vf-muted">
                        You&apos;re all caught up — no pending approvals.
                      </td>
                    </tr>
                  ) : (
                    approvalQueue.slice(0, 8).map((doc, rowIdx) => (
                      <tr
                        key={doc.id}
                        className="vf-row-in border-b border-[color:var(--vf-border)]"
                        style={{ animationDelay: `${480 + rowIdx * 70}ms` }}
                      >
                        <td className="px-5 py-3">
                          <Link
                            to="/documents/$id/review"
                            params={{ id: doc.id }}
                            className="font-medium vf-text hover:text-[#FFC107]"
                          >
                            {doc.subject}
                          </Link>
                          <p className="font-mono text-[11px] vf-muted">{doc.refId ?? doc.id}</p>
                        </td>
                        <td className="px-3 py-3 vf-muted">{doc.ownerName ?? "—"}</td>
                        <td className="px-3 py-3">
                          <StatusChip tone={doc.priority === "Normal" ? "muted" : "warn"}>{doc.priority}</StatusChip>
                        </td>
                        <td className="px-3 py-3 vf-muted">
                          {doc.submittedAt ? relTime(doc.submittedAt) : relTime(doc.createdAt)}
                        </td>
                        <td className="px-3 py-3">
                          <StatusChip tone={doc.sla === "overdue" ? "danger" : doc.sla === "at_risk" ? "warn" : "info"}>
                            {doc.sla === "overdue" ? "Overdue" : doc.sla === "at_risk" ? "At risk" : "Pending"}
                          </StatusChip>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            <Button
                              size="sm"
                              className="h-7 bg-[#00E676]/15 text-[#00E676] hover:bg-[#00E676]/25"
                              onClick={() => setConfirm({ id: doc.id, action: "approve", stepId: doc.currentStepId })}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-[#FF5252] hover:bg-[#FF5252]/10 hover:text-[#FF5252]"
                              onClick={() => setConfirm({ id: doc.id, action: "reject", stepId: doc.currentStepId })}
                            >
                              Reject
                            </Button>
                            <Button asChild size="sm" variant="ghost" className="h-7 vf-muted hover:text-[color:var(--vf-text)]">
                              <Link to="/documents/$id/review" params={{ id: doc.id }}>
                                View
                              </Link>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="grid gap-4 xl:grid-cols-12">
          {/* SECTION 7 — AI Insights */}
          <section className="vf-card vf-reveal vf-card-shine relative overflow-hidden p-5 xl:col-span-5" style={{ animationDelay: "480ms" }}>
            <div className="vf-hero-glow pointer-events-none absolute -right-8 top-0 h-32 w-32 rounded-full bg-[#FFC107]/10 blur-2xl" />
            <div className="relative z-10 flex items-center gap-3">
              <span className="vf-orb flex h-11 w-11 items-center justify-center rounded-2xl border border-[#FFC107]/30 bg-[#FFC107]/10 text-[#FFC107]">
                <Sparkles className="vf-sparkle h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base font-semibold vf-text">AI Insights</h2>
                <p className="text-sm vf-muted">Intelligent signals from VeriFlow AI</p>
              </div>
            </div>
            <ul className="relative z-10 mt-5 space-y-3">
              {[
                "13 duplicate files detected across Finance",
                "4 contracts expire this week",
                `Finance approval time improved ${metricsQ.data ? "22" : "22"}%`,
                "Storage optimization can save 18%",
                "OCR confidence increased this sprint",
              ].map((insight, i) => (
                <li
                  key={insight}
                  className="vf-chip-in flex items-start gap-2 rounded-xl border border-[color:var(--vf-border)] vf-surface px-3 py-2.5 text-sm vf-text"
                  style={{ animationDelay: `${520 + i * 70}ms` }}
                >
                  <Zap className="mt-0.5 h-4 w-4 shrink-0 text-[#FFD54F]" />
                  {insight}
                </li>
              ))}
            </ul>
          </section>

          {/* SECTION 8 — Document Health */}
          <section className="vf-card vf-reveal p-5 xl:col-span-4" style={{ animationDelay: "520ms" }}>
            <SectionHeading title="Document Health" subtitle="Integrity indicators" />
            <div className="mt-5 space-y-4">
              {[
                { label: "Verified", value: 94, color: SUCCESS, icon: BadgeCheck },
                { label: "Encrypted", value: 99, color: INFO, icon: ShieldCheck },
                { label: "Signed", value: 71, color: YELLOW, icon: CheckCircle2 },
                { label: "Expired", value: 8, color: DANGER, icon: ShieldAlert },
                { label: "Missing Metadata", value: 12, color: WARNING, icon: FileSearch },
                { label: "Broken Links", value: 3, color: MUTED, icon: Link2Off },
              ].map((row, i) => {
                const Icon = row.icon;
                return (
                  <div key={row.label} className="flex items-center gap-3">
                    <Icon className="h-4 w-4 shrink-0" style={{ color: row.color }} />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="vf-muted">{row.label}</span>
                        <span className="font-semibold vf-text">{row.value}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-[color:color-mix(in_oklab,var(--vf-text)_8%,transparent)]">
                        <div
                          className="vf-bar-fill h-full rounded-full"
                          style={{ width: `${row.value}%`, background: row.color, animationDelay: `${560 + i * 80}ms` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* SECTION 9 — Calendar */}
          <section className="vf-card vf-reveal p-5 xl:col-span-3" style={{ animationDelay: "560ms" }}>
            <SectionHeading title="Upcoming" subtitle="Calendar" />
            <ul className="mt-5 space-y-3">
              {[
                { tag: "Renewal", title: "Vendor MSA expires", when: "Wed · 10:00" },
                { tag: "Audit", title: "Q2 compliance audit", when: "Thu · 14:30" },
                { tag: "Review", title: "Policy review board", when: "Fri · 09:00" },
                { tag: "Deadline", title: "Budget pack due", when: "Mon · 17:00" },
              ].map((ev, i) => (
                <li
                  key={ev.title}
                  className="vf-chip-in rounded-xl border border-[color:var(--vf-border)] vf-surface px-3 py-2.5"
                  style={{ animationDelay: `${600 + i * 70}ms` }}
                >
                  <StatusChip tone="warn">{ev.tag}</StatusChip>
                  <p className="mt-2 text-sm font-medium vf-text">{ev.title}</p>
                  <p className="mt-0.5 text-xs vf-muted">{ev.when}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* SECTION 10 — Team Performance */}
          <section className="vf-card vf-reveal p-5" style={{ animationDelay: "600ms" }}>
            <SectionHeading title="Team Performance" subtitle="Leaderboard" />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                { title: "Top Approver", name: bottlenecksQ.data?.[0]?.approverDisplayName ?? "Ayesha Khan", meta: "128 actions", icon: Users },
                { title: "Fastest Reviewer", name: "Bilal Ahmed", meta: "2.4h avg", icon: Timer },
                { title: "Most Uploads", name: user.name, meta: `${mine.length || 46} docs`, icon: Upload },
                { title: "Highest Accuracy", name: "Sara Malik", meta: "99.2%", icon: BadgeCheck },
              ].map((card, i) => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.title}
                    className="vf-chip-in rounded-2xl border border-[color:var(--vf-border)] vf-panel p-4 transition-transform duration-300 hover:-translate-y-0.5"
                    style={{ animationDelay: `${640 + i * 70}ms` }}
                  >
                    <div className="flex items-center gap-2 text-[#FFC107]">
                      <Icon className="h-4 w-4" />
                      <span className="text-xs font-medium tracking-[0.12em] uppercase">{card.title}</span>
                    </div>
                    <p className="mt-3 text-lg font-semibold vf-text">{card.name}</p>
                    <p className="text-xs vf-muted">{card.meta}</p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* SECTION 11 — System Status */}
          <section className="vf-card vf-reveal p-5" style={{ animationDelay: "640ms" }}>
            <SectionHeading title="System Status" subtitle="Infrastructure health" />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                { label: "API", value: "Online", ok: true, icon: Server },
                { label: "Database", value: "Healthy", ok: true, icon: Database },
                { label: "Storage", value: `${storagePct}%`, ok: true, icon: HardDrive },
                { label: "AI Engine", value: "Running", ok: true, icon: Bot },
                { label: "OCR", value: "Operational", ok: true, icon: ScanLine },
                { label: "Email Service", value: "Connected", ok: true, icon: Mail },
              ].map((s, i) => {
                const Icon = s.icon;
                return (
                  <div
                    key={s.label}
                    className="vf-chip-in flex items-center gap-3 rounded-2xl border border-[color:var(--vf-border)] vf-panel px-3 py-3"
                    style={{ animationDelay: `${680 + i * 60}ms` }}
                  >
                    <Icon className="h-4 w-4 vf-muted" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs vf-muted">{s.label}</p>
                      <p className="text-sm font-semibold vf-text">{s.value}</p>
                    </div>
                    <span className={cn("h-2 w-2 rounded-full", s.ok ? "vf-live-dot bg-[#00E676]" : "bg-[#FF5252]")} />
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* SECTION 12 — Footer */}
        <footer className="vf-reveal flex flex-wrap items-center justify-between gap-3 border-t vf-hairline pt-4 pb-2 text-xs vf-muted" style={{ animationDelay: "720ms" }}>
          <div className="flex items-center gap-2">
            <Activity className="vf-soft-bob h-3.5 w-3.5 text-[#FFC107]" />
            <span className="font-medium vf-text">VeriFlow Enterprise</span>
            <span>·</span>
            <span>v2.4</span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="vf-sync-spin h-3.5 w-3.5" />
            Last sync · {format(now, "MMM d")} {format(now, "h:mm a")}
          </div>
        </footer>
      </div>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm?.action === "approve" ? "Approve document?" : "Reject document?"}
        description={
          confirm?.action === "approve"
            ? "A comment is required. This will move the document to the next approver or finalize it."
            : "This will reject the document and notify the owner."
        }
        confirmLabel={confirm?.action === "approve" ? "Approve" : "Reject"}
        variant={confirm?.action === "approve" ? "success" : "destructive"}
        requireReason
        reasonLabel={confirm?.action === "approve" ? "Comment" : "Reason"}
        onConfirm={runAction}
      />
    </div>
  );
}

const tooltipStyle = {
  background: "var(--vf-tooltip-bg)",
  border: "1px solid var(--vf-tooltip-border)",
  borderRadius: 12,
  color: "var(--vf-text)",
};

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h2 className="text-base font-semibold vf-text">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm vf-muted">{subtitle}</p>}
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
  className,
  chartHeight = 220,
  delay = 200,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  chartHeight?: number;
  delay?: number;
}) {
  return (
    <article
      className={cn("vf-card vf-lift vf-reveal vf-card-shine flex flex-col p-4 sm:p-5", className)}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="mb-3 shrink-0">
        <h3 className="text-sm font-semibold vf-text">{title}</h3>
        {subtitle && <p className="text-xs vf-muted">{subtitle}</p>}
      </div>
      <div className="w-full shrink-0 overflow-hidden" style={{ height: chartHeight }}>
        {children}
      </div>
    </article>
  );
}

function AnimatedNumber({ value, suffix = "", duration = 900 }: { value: number; suffix?: string; duration?: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setDisplay(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return (
    <>
      {display.toLocaleString()}
      {suffix}
    </>
  );
}

function MetaChip({
  children,
  icon: Icon,
  accent,
}: {
  children: React.ReactNode;
  icon: typeof Clock3;
  accent?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium",
        accent
          ? "border-[color:color-mix(in_oklab,var(--vf-yellow)_35%,transparent)] bg-[color:color-mix(in_oklab,var(--vf-yellow)_12%,transparent)] text-[color:var(--vf-gold)]"
          : "border-[color:var(--vf-border)] vf-surface vf-muted",
      )}
    >
      <Icon className={cn("h-3.5 w-3.5", accent && "vf-soft-bob")} />
      {children}
    </span>
  );
}

function StatusChip({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "success" | "warn" | "danger" | "info" | "muted";
}) {
  const styles = {
    success: "bg-[#00E676]/15 text-[#00E676]",
    warn: "bg-[#FFB300]/15 text-[#FFB300]",
    danger: "bg-[#FF5252]/15 text-[#FF5252]",
    info: "bg-[#29B6F6]/15 text-[#29B6F6]",
    muted: "vf-surface vf-muted",
  } as const;
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold", styles[tone])}>
      {children}
    </span>
  );
}
