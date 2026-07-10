import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/wdas/page-header";
import { useSession, isSuperAdmin } from "@/lib/wdas/role-context";
import { ApiError, getToken } from "@/lib/api/client";
import { wdasConfig } from "@/services/wdas-config";
import { useUsers } from "@/lib/wdas/users-context";
import {
  type Department, type Workflow, type ApprovalMode,
  type NotificationSettings, type SlaRule,
} from "@/lib/wdas/types";
import { Stepper } from "@/components/wdas/stepper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ApprovalModeBuilder, validateMatrix } from "@/components/wdas/approval-mode-builder";
import { DocumentTypeSelect } from "@/components/wdas/document-type-select";
import { ChevronLeft, ChevronRight, CheckCircle2, Info } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/config/workflows/new")({
  component: NewWorkflowWizard,
});

const STEPS = [
  "Basic Info", "Default To", "Approval Mode", "SLA & Escalation", "Notifications", "Review & Publish",
];

const defaultSla: SlaRule = { reminderHours: 24, escalationHours: 72 };
const defaultNotifications: NotificationSettings = {
  submit: { email: true, inApp: true, sms: false },
  approve: { email: true, inApp: true, sms: false },
  reject: { email: true, inApp: true, sms: false },
  reminder: { email: true, inApp: true, sms: false },
};

function NewWorkflowWizard() {
  const router = useRouter();
  const { role, scopeDept, user, isAuthed, hasRole } = useSession();
  const qc = useQueryClient();
  useEffect(() => { if (!hasRole("super_admin")) router.navigate({ to: "/dashboard" }); }, [hasRole, router]);

  const departmentsQ = useQuery({
    queryKey: ["departments"],
    queryFn: () => wdasConfig.listDepartments(true),
  });
  const workflowsQ = useQuery({
    queryKey: ["workflows"],
    queryFn: () => wdasConfig.listWorkflows("all"),
  });

  const departmentOptions = (departmentsQ.data ?? [])
    .filter((d) => d.isActive)
    .map((d) => d.name as Department);

  const [step, setStep] = useState(0);
  const [publishing, setPublishing] = useState(false);

  const [wf, setWf] = useState<Partial<Workflow>>({
    name: "",
    documentType: "",
    department: scopeDept === "all" ? "Finance" : scopeDept,
    type: "financial",
    mode: "user",
    approvalSequence: "sequential",
    defaultToIds: [],
    approverUserIds: [],
    matrixBands: [],
    groups: [],
    hybridFinalOwnerChoice: false,
    sla: defaultSla,
    notifications: defaultNotifications,
  });

  useEffect(() => {
    if (!departmentOptions.length) return;
    setWf((current) => {
      if (current.department && departmentOptions.includes(current.department)) {
        return current;
      }
      const preferred = scopeDept !== "all" && departmentOptions.includes(scopeDept)
        ? scopeDept
        : departmentOptions[0];
      return { ...current, department: preferred };
    });
  }, [departmentOptions.join("|"), scopeDept]);

  const duplicate = wdasConfig.findWorkflowDuplicate(workflowsQ.data ?? [], {
    name: wf.name ?? "",
    documentType: wf.documentType ?? "",
    department: wf.department,
  });

  const canNext = (() => {
    if (step === 0) return !!wf.name?.trim() && !!wf.documentType?.trim() && !!wf.department;
    if (step === 2 && wf.mode === "matrix") return validateMatrix(wf.matrixBands ?? []).length === 0;
    if (step === 2 && wf.mode === "user") return (wf.approverUserIds ?? []).length > 0;
    if (step === 2 && wf.mode === "hybrid") return (wf.approverUserIds ?? []).length > 0;
    return true;
  })();

  const publish = async () => {
    if (publishing) return;

    if (!isAuthed || !getToken()) {
      toast.error("Session expired", { description: "Please sign in again as Super Admin or Department Admin." });
      router.navigate({ to: "/login" });
      return;
    }

    setPublishing(true);
    const completingExisting = !!duplicate;
    try {
      await wdasConfig.createAndPublishWorkflow({
        id: `w-${Date.now()}`,
        name: wf.name!.trim(),
        description: wf.description ?? wf.name!,
        type: wf.type ?? "non_financial",
        department: wf.department,
        documentType: wf.documentType!.trim(),
        status: "active",
        version: 1,
        mode: wf.mode as ApprovalMode,
        approvalSequence: wf.approvalSequence,
        approverUserIds: wf.approverUserIds ?? [],
        defaultToIds: wf.defaultToIds ?? [],
        matrixBands: wf.matrixBands ?? [],
        groups: wf.groups ?? [],
        hybridFinalOwnerChoice: wf.hybridFinalOwnerChoice,
        sla: wf.sla,
        notifications: wf.notifications,
        versionHistory: [{ version: 1, publishedAt: new Date().toISOString(), publishedBy: user.name, note: "Initial publish" }],
      });

      toast.success(
        completingExisting ? "Workflow updated" : "Workflow published",
        { description: completingExisting ? `${wf.name} configuration was saved.` : `${wf.name} v1 is now active.` },
      );
      qc.invalidateQueries({ queryKey: ["workflows"] });
      router.navigate({ to: "/config/workflows" });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const body = e.body as { code?: string; details?: { workflowId?: string } } | undefined;
        const existingId = body?.details?.workflowId;
        const isDuplicate = body?.code === "workflow_exists" || e.message.includes("already exists");
        toast.error(e.message, {
          description: isDuplicate
            ? "Open the existing workflow or use a different name or document type."
            : "Refresh the page and try publishing again.",
          ...(existingId
            ? {
                action: {
                  label: "Open workflow",
                  onClick: () => router.navigate({ to: "/config/workflows/$id", params: { id: existingId } }),
                },
              }
            : {}),
        });
      } else {
        toast.error((e as Error).message || "Could not publish workflow.");
      }
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="New workflow"
        subtitle="Configure the routing, approval mode, SLA and notifications for a new document type."
        actions={<Button variant="ghost" onClick={() => router.history.back()}>Cancel</Button>}
      />
      <div className="space-y-4 p-6">
        <Stepper steps={STEPS} current={step} onStepClick={(i) => i <= step && setStep(i)} />

        <Card>
          <CardHeader><CardTitle className="text-base">{STEPS[step]}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {step === 0 && (
              <BasicInfoStep
                wf={wf}
                setWf={setWf}
                lockedDept={role === "dept_admin" ? scopeDept as Department : undefined}
                departmentOptions={departmentOptions}
                duplicate={duplicate}
              />
            )}
            {step === 1 && <DefaultToStep wf={wf} setWf={setWf} />}
            {step === 2 && <ApprovalModeBuilder value={wf} onChange={setWf} />}
            {step === 3 && <SlaStep wf={wf} setWf={setWf} />}
            {step === 4 && <NotificationsStep wf={wf} setWf={setWf} />}
            {step === 5 && <ReviewStep wf={wf} duplicate={duplicate} />}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
              Next <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={publish}
              disabled={publishing}
              className="bg-success text-success-foreground hover:bg-success/90"
            >
              <CheckCircle2 className="mr-1 h-4 w-4" /> {publishing ? "Publishing…" : "Publish workflow"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function BasicInfoStep({
  wf,
  setWf,
  lockedDept,
  departmentOptions,
  duplicate,
}: {
  wf: Partial<Workflow>;
  setWf: (v: Partial<Workflow>) => void;
  lockedDept?: Department;
  departmentOptions: Department[];
  duplicate?: Workflow;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label>Name <span className="text-destructive">*</span></Label>
        <Input value={wf.name ?? ""} onChange={(e) => setWf({ ...wf, name: e.target.value })} placeholder="e.g. Capex Approval" />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <DocumentTypeSelect
          required
          value={wf.documentType}
          onChange={({ code, name, category }) =>
            setWf({
              ...wf,
              documentType: code,
              description: name,
              type: category === "financial" ? "financial" : "non_financial",
            })
          }
        />
      </div>
      <div className="space-y-1.5">
        <Label>Department <span className="text-destructive">*</span></Label>
        <Select value={wf.department} onValueChange={(v) => setWf({ ...wf, department: v as Department })} disabled={!!lockedDept}>
          <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
          <SelectContent>
            {departmentOptions.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        {lockedDept && <p className="text-xs text-muted-foreground">Scoped to your department.</p>}
        {!departmentOptions.length && (
          <p className="text-xs text-destructive">No departments found. Create one under Configuration → Departments.</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label>Workflow type</Label>
        <Select value={wf.type} onValueChange={(v) => setWf({ ...wf, type: v as "financial" | "non_financial" })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="financial">Financial (amount-driven)</SelectItem>
            <SelectItem value="non_financial">Non-financial</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Approval routing</Label>
        <Select
          value={wf.approvalSequence ?? "sequential"}
          onValueChange={(v) => setWf({ ...wf, approvalSequence: v as "sequential" | "parallel" })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="sequential">Sequential — approvers act one after another</SelectItem>
            <SelectItem value="parallel">Parallel — all approvers act at the same time</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {duplicate && (
        <Alert className="sm:col-span-2">
          <AlertTitle>Workflow already exists</AlertTitle>
          <AlertDescription>
            &quot;{duplicate.name}&quot; is already in {duplicate.department} for this document type. Publishing will save the approval settings to that workflow.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function DefaultToStep({ wf, setWf }: { wf: Partial<Workflow>; setWf: (v: Partial<Workflow>) => void }) {
  const { users } = useUsers();
  const on = new Set(wf.defaultToIds ?? []);
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Optional. Pre-select recipients so Makers don't have to choose the "To" group every time.</p>
      <div className="flex flex-wrap gap-1.5">
        {users.map((u) => {
          const active = on.has(u.id);
          return (
            <button
              key={u.id} type="button"
              onClick={() => {
                const next = new Set(on);
                if (active) next.delete(u.id); else next.add(u.id);
                setWf({ ...wf, defaultToIds: [...next] });
              }}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs",
                active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {u.name} <span className="text-muted-foreground">· {u.department}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SlaStep({ wf, setWf }: { wf: Partial<Workflow>; setWf: (v: Partial<Workflow>) => void }) {
  const { users } = useUsers();
  const sla = wf.sla ?? defaultSla;
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="space-y-1.5">
        <Label>Reminder after (hours)</Label>
        <Input type="number" value={sla.reminderHours} onChange={(e) => setWf({ ...wf, sla: { ...sla, reminderHours: Number(e.target.value) || 0 } })} />
      </div>
      <div className="space-y-1.5">
        <Label>Escalate after (hours)</Label>
        <Input type="number" value={sla.escalationHours} onChange={(e) => setWf({ ...wf, sla: { ...sla, escalationHours: Number(e.target.value) || 0 } })} />
      </div>
      <div className="space-y-1.5">
        <Label>Escalation contact</Label>
        <Select value={sla.escalationUserId ?? ""} onValueChange={(v) => setWf({ ...wf, sla: { ...sla, escalationUserId: v } })}>
          <SelectTrigger><SelectValue placeholder="Choose user" /></SelectTrigger>
          <SelectContent>
            {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name} · {u.department}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Alert className="sm:col-span-3">
        <Info className="h-4 w-4" />
        <AlertDescription>
          Reminders are sent to the current approver. If not acted upon by the escalation threshold, the escalation contact receives a heads-up.
        </AlertDescription>
      </Alert>
    </div>
  );
}

function NotificationsStep({ wf, setWf }: { wf: Partial<Workflow>; setWf: (v: Partial<Workflow>) => void }) {
  const n = wf.notifications ?? defaultNotifications;
  const events: (keyof NotificationSettings)[] = ["submit", "approve", "reject", "reminder"];
  const eventLabel: Record<keyof NotificationSettings, string> = { submit: "Document submitted", approve: "Approved / step passed", reject: "Rejected", reminder: "SLA reminder" };
  const channels: ("email" | "inApp" | "sms")[] = ["email", "inApp", "sms"];
  const channelLabel = { email: "Email", inApp: "In-app", sms: "SMS / WhatsApp" };
  return (
    <div className="rounded-md border">
      <div className="grid grid-cols-[1fr_120px_120px_140px] items-center gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
        <span>Event</span><span>Email</span><span>In-app</span><span>SMS / WhatsApp</span>
      </div>
      {events.map((ev) => (
        <div key={ev} className="grid grid-cols-[1fr_120px_120px_140px] items-center gap-2 border-b px-3 py-2 last:border-0">
          <span className="text-sm">{eventLabel[ev]}</span>
          {channels.map((ch) => (
            <Switch
              key={ch}
              checked={n[ev][ch]}
              onCheckedChange={(v) => setWf({
                ...wf,
                notifications: { ...n, [ev]: { ...n[ev], [ch]: v } },
              })}
            />
          ))}
        </div>
      ))}
      <p className="p-3 text-[11px] text-muted-foreground">{channelLabel.email} / {channelLabel.inApp} / {channelLabel.sms} channels — toggle per event.</p>
    </div>
  );
}

function ReviewStep({ wf, duplicate }: { wf: Partial<Workflow>; duplicate?: Workflow }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" value={wf.name} />
        <Field label="Document Type" value={wf.description || wf.documentType} />
        <Field label="Department" value={wf.department} />
        <Field label="Workflow type" value={wf.type} />
        <Field label="Approval routing" value={wf.approvalSequence === "parallel" ? "Parallel" : "Sequential"} />
        <Field label="Approval mode" value={wf.mode} />
        <Field label="SLA" value={`Reminder ${wf.sla?.reminderHours}h · Escalate ${wf.sla?.escalationHours}h`} />
      </div>
      {duplicate ? (
        <Alert>
          <AlertTitle>Will update existing workflow</AlertTitle>
          <AlertDescription>
            &quot;{duplicate.name}&quot; already exists. Publishing saves your approval configuration to that workflow.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Ready to publish v1</AlertTitle>
          <AlertDescription>Publishing activates this workflow immediately for new documents in {wf.department}.</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium">{value || "—"}</p>
    </div>
  );
}
