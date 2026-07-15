import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/wdas/page-header";
import { LoadingState, ErrorState } from "@/components/wdas/data-states";
import { useSession, isSuperAdmin } from "@/lib/wdas/role-context";
import { P } from "@/lib/wdas/permissions";
import { wdasConfig } from "@/services/wdas-config";
import { ApprovalModeBuilder } from "@/components/wdas/approval-mode-builder";
import { DocumentTypeSelect } from "@/components/wdas/document-type-select";
import { ChainPreview } from "@/components/wdas/stepper";
import { resolveWorkflowChain } from "@/components/wdas/approval-mode-builder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/wdas/confirm-dialog";
import { relTime } from "@/lib/wdas/format";
import type { Workflow } from "@/lib/wdas/types";
import { CheckCircle2, History, FlaskConical, Save, Copy, Layers } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import type { NotificationSettings } from "@/lib/wdas/types";
import { ActiveStatusBadge, ActiveStatusSwitch } from "@/components/wdas/active-status";

export const Route = createFileRoute("/config/workflows/$id")({
  component: WorkflowDetail,
});

function WorkflowDetail() {
  const router = useRouter();
  const { id } = Route.useParams();
  const { role, user, can } = useSession();
  const qc = useQueryClient();
  useEffect(() => { if (!can(P.config.workflows)) router.navigate({ to: "/dashboard" }); }, [can, router]);

  const q = useQuery({
    queryKey: ["workflow", id],
    queryFn: () => wdasConfig.getWorkflow(id),
  });

  const versionsQ = useQuery({
    queryKey: ["workflow-versions", id],
    queryFn: () => wdasConfig.getWorkflowVersions(id),
  });

  const allWorkflowsQ = useQuery({
    queryKey: ["workflows"],
    queryFn: () => wdasConfig.listWorkflows("all"),
  });

  const [draft, setDraft] = useState<Partial<Workflow> | null>(null);
  const [note, setNote] = useState("");
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [testAmount, setTestAmount] = useState(120000);
  const [cloneSourceId, setCloneSourceId] = useState("");
  const [publishing, setPublishing] = useState(false);

  // Load server data into the editor once per fetch â€” do not overwrite in-progress edits.
  useEffect(() => {
    if (q.data && draft === null) setDraft(q.data);
  }, [q.data, draft]);

  // Reset local editor when navigating to a different workflow.
  useEffect(() => {
    setDraft(null);
  }, [id]);

  if (q.isLoading && !draft) return <div className="p-6"><LoadingState /></div>;
  if (q.isError || !q.data) return <div className="p-6"><ErrorState message="Workflow not found." onRetry={() => q.refetch()} /></div>;
  const w = q.data;
  const d = draft ?? w;

  const publish = async () => {
    if (publishing) return;
    if ((d.mode === "user" || d.mode === "hybrid") && !(d.approverUserIds?.length)) {
      toast.error("Select at least one approver before publishing.");
      return;
    }
    setPublishing(true);
    try {
      const saved = await wdasConfig.publishWorkflowVersion(w.id, {
        name: d.name, documentType: d.documentType, department: d.department, type: d.type,
        mode: d.mode, approvalSequence: d.approvalSequence,
        matrixBands: d.matrixBands, groups: d.groups,
        approverUserIds: d.approverUserIds ?? [],
        hybridFinalOwnerChoice: d.hybridFinalOwnerChoice,
        defaultToIds: d.defaultToIds, sla: d.sla, notifications: d.notifications,
      }, user.name, note || undefined);
      toast.success("Published", {
        description: `${saved.name} saved with ${(saved.approverUserIds ?? []).length} approver(s).`,
      });
      setNote("");
      setDraft(null);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["workflow", id] }),
        qc.invalidateQueries({ queryKey: ["workflows"] }),
        qc.invalidateQueries({ queryKey: ["workflow-versions", id] }),
      ]);
      const fresh = await q.refetch();
      if (fresh.data) setDraft(fresh.data);
    } catch (e) {
      toast.error((e as Error).message || "Could not publish workflow.");
    } finally {
      setPublishing(false);
      setConfirmPublish(false);
    }
  };

  const testPreview = resolveWorkflowChain(d.mode ?? "user", { bands: d.matrixBands, groups: d.groups, approverUserIds: d.approverUserIds, hybridFinalOwnerChoice: d.hybridFinalOwnerChoice }, testAmount);

  const defaultNotifications: NotificationSettings = {
    submit: { email: true, inApp: true, sms: false },
    approve: { email: true, inApp: true, sms: false },
    reject: { email: true, inApp: true, sms: true },
    reminder: { email: true, inApp: true, sms: false },
  };
  const notifications = d.notifications ?? defaultNotifications;

  const applyCfoTemplate = () => {
    const ts = Date.now();
    setDraft({
      ...d,
      mode: "matrix",
      matrixBands: [
        { id: `b-${ts}-1`, min: 0, max: 50000, approverUserIds: [], approverGroupIds: [], sequence: "sequential" },
        { id: `b-${ts}-2`, min: 50001, max: 500000, approverUserIds: [], approverGroupIds: [], sequence: "sequential" },
        { id: `b-${ts}-3`, min: 500001, max: null, approverUserIds: [], approverGroupIds: [], sequence: "sequential" },
      ],
    });
    toast.success("CFO amount bands applied — select a user on each band before publishing.");
  };

  const cloneMatrix = async () => {
    if (!cloneSourceId) {
      toast.error("Select a source workflow");
      return;
    }
    await wdasConfig.cloneMatrixFromWorkflow(id, cloneSourceId);
    await q.refetch();
    setDraft(null);
    toast.success("Matrix tiers copied â€” reload draft from saved workflow.");
  };

  return (
    <div>
      <PageHeader
        title={w.name}
        subtitle={`${w.department} Â· ${w.documentType} Â· v${w.version ?? 1} Â· ${w.status?.toUpperCase()}`}
        actions={
          <>
            <ActiveStatusBadge active={w.isActive !== false} />
            {w.status === "pending" && (
              <Badge variant="outline" className="border-warning/40 bg-warning/20 text-warning-foreground">PENDING</Badge>
            )}
            <Button variant="outline" onClick={() => router.history.back()}>Back</Button>
            {can(P.config.workflowsCheck) && w.status === "pending" && (
              <Button
                disabled={publishing}
                className="bg-success text-success-foreground hover:bg-success/90"
                onClick={async () => {
                  setPublishing(true);
                  try {
                    await wdasConfig.approveWorkflow(w.id);
                    toast.success("Workflow approved", { description: `${w.name} is now active.` });
                    await Promise.all([
                      qc.invalidateQueries({ queryKey: ["workflow", id] }),
                      qc.invalidateQueries({ queryKey: ["workflows"] }),
                    ]);
                    setDraft(null);
                    await q.refetch();
                  } catch (e) {
                    toast.error((e as Error).message || "Could not approve workflow.");
                  } finally {
                    setPublishing(false);
                  }
                }}
              >
                <CheckCircle2 className="mr-1 h-4 w-4" /> {publishing ? "Approving…" : "Approve"}
              </Button>
            )}
            {can(P.config.workflowsCheck) && w.status !== "pending" && (
              <Button disabled={publishing} onClick={() => setConfirmPublish(true)}>
                <Save className="mr-1 h-4 w-4" /> {publishing ? "Publishing…" : "Publish new version"}
              </Button>
            )}
          </>
        }
      />
      <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Basic info</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <ActiveStatusSwitch
                  active={w.isActive !== false}
                  label="Workflow active (available for new documents)"
                  disabled={!can(P.config.workflowsCheck)}
                  onChange={async (isActive) => {
                    try {
                      await wdasConfig.setWorkflowActiveStatus(w.id, isActive);
                      toast.success(isActive ? "Workflow activated" : "Workflow deactivated");
                      q.refetch();
                      qc.invalidateQueries({ queryKey: ["workflows"] });
                    } catch (err) {
                      toast.error((err as Error).message || "Could not update workflow status.");
                    }
                  }}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Approval routing</Label>
                <Select
                  value={d.approvalSequence ?? "sequential"}
                  onValueChange={(v) => setDraft({ ...d, approvalSequence: v as "sequential" | "parallel" })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sequential">Sequential â€” approvers act one after another</SelectItem>
                    <SelectItem value="parallel">Parallel â€” all approvers act at the same time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Name</Label><Input value={d.name ?? ""} onChange={(e) => setDraft({ ...d, name: e.target.value })} /></div>
              <div className="space-y-1.5">
                <DocumentTypeSelect
                  value={d.documentType}
                  onChange={({ code, name, category }) =>
                    setDraft({
                      ...d,
                      documentType: code,
                      description: name,
                      type: category === "financial" ? "financial" : "non_financial",
                    })
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Policy & SLA</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Return-for-correction policy</Label>
                <select
                  className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={d.returnResumePolicy ?? "RestartFromFirst"}
                  onChange={(e) => setDraft({ ...d, returnResumePolicy: e.target.value as Workflow["returnResumePolicy"] })}
                >
                  <option value="RestartFromFirst">Restart from first approver</option>
                  <option value="ResumeAfterReturningStep">Resume after returning step</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>SLA escalation (hours)</Label>
                <Input
                  type="number"
                  value={d.sla?.escalationHours ?? 48}
                  onChange={(e) => setDraft({ ...d, sla: { reminderHours: 24, escalationHours: Number(e.target.value) || 48 } })}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><Layers className="h-4 w-4" /> Matrix templates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">Apply a standard financial approval ladder or copy tiers from another workflow in your department.</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={applyCfoTemplate}>CFO executive preset</Button>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[200px] flex-1 space-y-1">
                  <Label className="text-xs">Copy matrix from</Label>
                  <select
                    className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
                    value={cloneSourceId}
                    onChange={(e) => setCloneSourceId(e.target.value)}
                  >
                    <option value="">Select workflowâ€¦</option>
                    {(allWorkflowsQ.data ?? []).filter((w) => w.id !== id).map((w) => (
                      <option key={w.id} value={w.id}>{w.name} ({w.department})</option>
                    ))}
                  </select>
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={() => void cloneMatrix()}>
                  <Copy className="mr-1 h-3.5 w-3.5" /> Clone matrix
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Notification channels (workflow default)</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {(["submit", "approve", "reject", "reminder"] as const).map((event) => (
                <div key={event} className="flex flex-wrap items-center gap-4 rounded-md border px-3 py-2 text-sm">
                  <span className="w-28 font-medium capitalize">{event}</span>
                  {(["email", "inApp", "sms"] as const).map((ch) => (
                    <label key={ch} className="flex items-center gap-1.5 text-xs">
                      <Switch
                        checked={notifications[event][ch]}
                        onCheckedChange={(v) =>
                          setDraft({
                            ...d,
                            notifications: {
                              ...notifications,
                              [event]: { ...notifications[event], [ch]: v },
                            },
                          })
                        }
                      />
                      {ch === "inApp" ? "In-app" : ch.toUpperCase()}
                    </label>
                  ))}
                </div>
              ))}
            </CardContent>
          </Card>

          <ApprovalModeBuilder value={d} onChange={(patch) => setDraft((prev) => ({ ...(prev ?? w), ...patch }))} />

          <Card>
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><FlaskConical className="h-4 w-4 text-info" /> Preview / Test Mode</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Label className="text-xs text-muted-foreground">Sample amount (PKR)</Label>
                <Input type="number" value={testAmount} onChange={(e) => setTestAmount(Number(e.target.value) || 0)} className="h-8 w-40" />
                <p className="text-xs text-muted-foreground">No document is created â€” this only shows the resolved approval chain.</p>
              </div>
              <ChainPreview nodes={testPreview} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4" /> Version history</CardTitle></CardHeader>
            <CardContent className="space-y-2 p-0">
              {(versionsQ.data ?? []).slice().reverse().map((v) => (
                <div key={v.id} className="border-b px-4 py-3 last:border-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono">v{v.versionNumber}</Badge>
                    {v.versionNumber === w.version && <Badge className="bg-success/15 text-success" variant="outline">Current</Badge>}
                    <Badge variant="outline" className="text-xs">{v.state}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{v.approvalMode} Â· SLA {v.slaThresholdHours ?? "â€”"}h</p>
                </div>
              ))}
              {versionsQ.isLoading && <p className="p-4 text-sm text-muted-foreground">Loading versionsâ€¦</p>}
              {!versionsQ.isLoading && !versionsQ.data?.length && (
                <p className="p-4 text-sm text-muted-foreground">No version history yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmPublish} onOpenChange={setConfirmPublish}
        title="Publish a new version?"
        description={<>Publishing creates version <b>v{(w.version ?? 1) + 1}</b>. In-flight documents will keep running on <b>v{w.version ?? 1}</b>; only new documents use the new version.</>}
        variant="success" confirmLabel="Publish version"
        extraContent={
          <div className="space-y-1.5">
            <Label>Change note (optional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Summary of what changedâ€¦" />
          </div>
        }
        onConfirm={publish}
      />
      <div className="hidden"><CheckCircle2 /></div>
    </div>
  );
}
