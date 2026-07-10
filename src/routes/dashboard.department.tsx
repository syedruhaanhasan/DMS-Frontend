import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/wdas/page-header";
import { LoadingState, ErrorState, EmptyState } from "@/components/wdas/data-states";
import { useSession } from "@/lib/wdas/role-context";
import { wdas } from "@/services/wdas";
import { wdasConfig } from "@/services/wdas-config";
import { DocumentTable } from "@/components/wdas/document-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Building2, ArrowLeft, ShieldCheck, Clock3, FileText } from "lucide-react";
import { useLanguage } from "@/lib/wdas/language-context";
import { t } from "@/lib/wdas/i18n";

export const Route = createFileRoute("/dashboard/department")({
  component: DepartmentDashboardPage,
});

function DepartmentDashboardPage() {
  const router = useRouter();
  const { role, user } = useSession();
  const { lang } = useLanguage();

  useEffect(() => {
    if (role !== "dept_admin") router.navigate({ to: "/dashboard" });
  }, [role, router]);

  const deptsQ = useQuery({
    queryKey: ["departments"],
    queryFn: () => wdasConfig.listDepartments(),
  });

  const defaultDeptId = useMemo(() => {
    if (user.departmentId) return user.departmentId;
    return deptsQ.data?.[0]?.id ?? "";
  }, [user.departmentId, deptsQ.data]);

  const [deptId, setDeptId] = useState("");

  useEffect(() => {
    if (!deptId && defaultDeptId) setDeptId(defaultDeptId);
  }, [deptId, defaultDeptId]);

  const dashQ = useQuery({
    queryKey: ["dashboard", "department", deptId],
    queryFn: () => wdas.getDepartmentDashboard(deptId),
    enabled: !!deptId,
  });

  const metricsQ = useQuery({
    queryKey: ["reports", "success-metrics", deptId],
    queryFn: () => wdas.getSuccessMetrics(deptId),
    enabled: !!deptId,
  });

  const docs = dashQ.data?.documents ?? [];
  const inProgress = docs.filter((d) => !["approved", "rejected", "cancelled"].includes(d.status));
  const overdue = docs.filter((d) => d.sla === "overdue");

  return (
    <div>
      <PageHeader
        title={t("deptDashboard", lang)}
        subtitle={dashQ.data?.departmentName ?? "Department-wide workflow visibility"}
        actions={
          <Button variant="outline" asChild>
            <Link to="/dashboard"><ArrowLeft className="mr-1 h-4 w-4" /> {t("dashboard", lang)}</Link>
          </Button>
        }
      />
      <div className="space-y-6 p-6">
        {role === "super_admin" && (
          <Card>
            <CardContent className="grid gap-3 p-4 md:grid-cols-[240px_1fr] md:items-end">
              <div className="space-y-1.5">
                <Label className="text-xs">Department</Label>
                <Select value={deptId} onValueChange={setDeptId}>
                  <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>
                    {(deptsQ.data ?? []).map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-sm text-muted-foreground">
                <Building2 className="mr-1 inline h-4 w-4" />
                {docs.length} documents in this department view
              </p>
            </CardContent>
          </Card>
        )}

        {metricsQ.data && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricTile
              icon={<Clock3 className="h-4 w-4" />}
              label={t("avgCycleTime", lang)}
              value={`${metricsQ.data.averageCycleTimeDays} ${t("days", lang)}`}
            />
            <MetricTile
              icon={<FileText className="h-4 w-4" />}
              label={t("adoptionRate", lang)}
              value={`${metricsQ.data.adoptionRatePercent}%`}
            />
            <MetricTile
              icon={<ShieldCheck className="h-4 w-4" />}
              label={t("slaCompliance", lang)}
              value={`${metricsQ.data.slaCompliancePercent}%`}
            />
            <MetricTile
              icon={<ShieldCheck className="h-4 w-4" />}
              label={t("slaBreaches", lang)}
              value={String(metricsQ.data.slaBreachCount)}
            />
          </div>
        )}

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" /> Department documents
              <Badge variant="secondary">{docs.length}</Badge>
            </CardTitle>
            <div className="flex gap-2 text-xs text-muted-foreground">
              <span>{inProgress.length} in progress</span>
              <span>·</span>
              <span className="text-destructive">{overdue.length} overdue</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {dashQ.isLoading ? <LoadingState /> :
              dashQ.isError ? <ErrorState message="Could not load department dashboard." onRetry={() => dashQ.refetch()} /> :
              !docs.length ? <EmptyState title="No documents" description="This department has no documents yet." /> :
              <DocumentTable docs={docs} showStatus />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between p-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
        </div>
        <div className="rounded-md bg-muted p-2 text-muted-foreground">{icon}</div>
      </CardContent>
    </Card>
  );
}
