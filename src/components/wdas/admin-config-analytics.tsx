import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Building2, Network, Users, Workflow } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState, ErrorState } from "@/components/wdas/data-states";
import { wdasConfig } from "@/services/wdas-config";

const COLORS = ["#f59e0b", "#27272a", "#d97706", "#71717a", "#fbbf24"];

export function AdminConfigAnalytics() {
  const usersQ = useQuery({
    queryKey: ["dashboard", "config-analytics", "users"],
    queryFn: () => wdasConfig.listUsers(),
  });
  const departmentsQ = useQuery({
    queryKey: ["dashboard", "config-analytics", "departments"],
    queryFn: () => wdasConfig.listDepartments(),
  });
  const workflowsQ = useQuery({
    queryKey: ["dashboard", "config-analytics", "workflows"],
    queryFn: () => wdasConfig.listWorkflows("all"),
  });

  const users = usersQ.data ?? [];
  const departments = departmentsQ.data ?? [];
  const workflows = workflowsQ.data ?? [];

  const analytics = useMemo(() => {
    const departmentRows = departments
      .map((department) => ({
        name: department.name,
        users: users.filter((user) => user.departmentId === department.id).length,
        workflows: workflows.filter((workflow) => workflow.department === department.name).length,
      }))
      .sort((a, b) => (b.users + b.workflows) - (a.users + a.workflows));

    const workflowStatuses = [
      { name: "Active", value: workflows.filter((workflow) => workflow.isActive !== false && workflow.status === "active").length },
      { name: "Draft", value: workflows.filter((workflow) => workflow.status === "draft").length },
      { name: "Pending", value: workflows.filter((workflow) => workflow.status === "pending").length },
      { name: "Archived", value: workflows.filter((workflow) => workflow.status === "archived" || workflow.isActive === false).length },
    ].filter((item) => item.value > 0);

    const modeLabels = {
      matrix: "Matrix",
      user: "User based",
      adhoc: "Ad-hoc",
      hybrid: "Hybrid",
    } as const;
    const workflowModes = Object.entries(modeLabels)
      .map(([mode, label]) => ({
        name: label,
        value: workflows.filter((workflow) => workflow.mode === mode).length,
      }))
      .filter((item) => item.value > 0);

    return { departmentRows, workflowStatuses, workflowModes };
  }, [departments, users, workflows]);

  if (usersQ.isLoading || departmentsQ.isLoading || workflowsQ.isLoading) {
    return <LoadingState />;
  }

  if (usersQ.isError || departmentsQ.isError || workflowsQ.isError) {
    return (
      <ErrorState
        message="Could not load system analytics."
        onRetry={() => {
          usersQ.refetch();
          departmentsQ.refetch();
          workflowsQ.refetch();
        }}
      />
    );
  }

  const kpis = [
    {
      label: "Users",
      value: users.length,
      detail: `${users.filter((user) => user.isActive !== false).length} active`,
      icon: Users,
      color: "text-amber-600",
      background: "from-amber-500/15 to-amber-500/5",
    },
    {
      label: "Departments",
      value: departments.length,
      detail: `${departments.filter((department) => department.isActive).length} active`,
      icon: Building2,
      color: "text-zinc-700 dark:text-zinc-300",
      background: "from-zinc-500/15 to-zinc-500/5",
    },
    {
      label: "Workflows",
      value: workflows.length,
      detail: `${workflows.filter((workflow) => workflow.isActive !== false).length} active`,
      icon: Workflow,
      color: "text-amber-600",
      background: "from-amber-500/15 to-orange-500/5",
    },
  ];

  const tooltipStyle = {
    borderRadius: 12,
    borderColor: "rgba(148,163,184,0.25)",
    boxShadow: "0 18px 42px -24px rgba(15,23,42,0.35)",
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-amber-500" />
            <h2 className="text-xl font-semibold tracking-tight">System analytics</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Live users, departments, and workflow configuration data.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
          <Network className="h-3.5 w-3.5 text-amber-500" />
          Live data
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} className={`overflow-hidden border-border/70 bg-gradient-to-br ${kpi.background}`}>
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{kpi.label}</p>
                  <p className="mt-1 text-3xl font-semibold tracking-tight">{kpi.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{kpi.detail}</p>
                </div>
                <div className={`rounded-2xl border bg-background/70 p-3 shadow-sm ${kpi.color}`}>
                  <Icon className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <Card className="overflow-hidden border-border/70">
          <CardHeader>
            <CardTitle className="text-base">Department footprint</CardTitle>
            <p className="text-sm text-muted-foreground">Current users and workflows by department.</p>
          </CardHeader>
          <CardContent className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.departmentRows} margin={{ left: 0, right: 12, top: 12, bottom: 30 }}>
                <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.18)" />
                <XAxis dataKey="name" angle={-18} textAnchor="end" interval={0} height={68} tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} />
                <Tooltip cursor={{ fill: "rgba(255,196,0,0.08)" }} contentStyle={tooltipStyle} />
                <Legend />
                <Bar dataKey="users" name="Users" fill="#f59e0b" radius={[7, 7, 0, 0]} />
                <Bar dataKey="workflows" name="Workflows" fill="#27272a" radius={[7, 7, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/70">
          <CardHeader>
            <CardTitle className="text-base">Workflow portfolio</CardTitle>
            <p className="text-sm text-muted-foreground">Live workflow status distribution.</p>
          </CardHeader>
          <CardContent className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics.workflowStatuses.length ? analytics.workflowStatuses : [{ name: "No workflows", value: 1 }]}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={65}
                  outerRadius={105}
                  paddingAngle={4}
                >
                  {(analytics.workflowStatuses.length ? analytics.workflowStatuses : [{ name: "No workflows", value: 1 }]).map((item, index) => (
                    <Cell key={item.name} fill={analytics.workflowStatuses.length ? COLORS[index % COLORS.length] : "#cbd5e1"} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend verticalAlign="bottom" />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border-border/70">
        <CardHeader>
          <CardTitle className="text-base">Workflow design modes</CardTitle>
          <p className="text-sm text-muted-foreground">How current approval workflows are configured.</p>
        </CardHeader>
        <CardContent className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={analytics.workflowModes.length ? analytics.workflowModes : [{ name: "No workflows", value: 0 }]}
              layout="vertical"
              margin={{ left: 20, right: 24 }}
            >
              <CartesianGrid horizontal={false} stroke="rgba(148,163,184,0.18)" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} />
              <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12, fill: "#64748b" }} />
              <Tooltip cursor={{ fill: "rgba(20,184,166,0.05)" }} contentStyle={tooltipStyle} />
              <Bar dataKey="value" name="Workflows" radius={[0, 8, 8, 0]}>
                {analytics.workflowModes.map((item, index) => (
                  <Cell key={item.name} fill={COLORS[(index + 1) % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </section>
  );
}
