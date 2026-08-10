import type { ApprovalStep } from "@/lib/wdas/types";
import { useUserById } from "@/lib/wdas/users-context";
import { relTime, absTime } from "@/lib/wdas/format";
import { Check, X, RotateCcw, Clock, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

function ApprovalStepItem({ step, currentStepId }: { step: ApprovalStep; currentStepId?: string }) {
  const user = useUserById(step.approverId);
  const isCurrent = step.id === currentStepId;
  const icon = step.status === "approved" ? <Check className="h-3.5 w-3.5" />
    : step.status === "rejected" ? <X className="h-3.5 w-3.5" />
    : step.status === "returned" ? <RotateCcw className="h-3.5 w-3.5" />
    : <Clock className="h-3.5 w-3.5" />;
  const dotCls = step.status === "approved" ? "bg-success text-success-foreground"
    : step.status === "rejected" ? "bg-destructive text-destructive-foreground"
    : step.status === "returned" ? "bg-warning text-warning-foreground"
    : isCurrent ? "bg-info text-info-foreground ring-4 ring-info/20"
    : "bg-muted text-muted-foreground";
  const cycleLabel = step.approvalCycle && step.approvalCycle > 1 ? ` · Round ${step.approvalCycle}` : "";

  return (
    <li className="relative">
      <span className={cn("absolute -left-[1.6rem] top-1 flex h-6 w-6 items-center justify-center rounded-full border border-white/70 shadow-sm", dotCls)}>
        {icon}
      </span>
      <div className="rounded-xl border border-border/70 bg-card/80 p-3 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">{user?.name ?? "—"} <span className="font-normal text-muted-foreground">· {user?.designation}</span></p>
            <p className="mt-1 text-xs text-muted-foreground">Step {step.order}{cycleLabel} · {user?.department}</p>
          </div>
          {step.actedAt && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs text-muted-foreground">{relTime(step.actedAt)}</span>
              </TooltipTrigger>
              <TooltipContent>{absTime(step.actedAt)}</TooltipContent>
            </Tooltip>
          )}
        </div>
        {(step.actionHistory?.length
          ? step.actionHistory
          : step.comment
            ? [{ id: `${step.id}-note`, actorName: undefined as string | undefined, comment: step.comment }]
            : []
        ).map((entry, idx) =>
          entry.comment ? (
            <div key={entry.id ?? `${step.id}-note-${idx}`} className="mt-3 rounded-lg border border-border/70 bg-background/70 p-3 text-sm leading-6 text-foreground/90">
              {entry.actorName ? (
                <p className="mb-1 text-xs font-medium text-muted-foreground">{entry.actorName}</p>
              ) : null}
              {entry.comment}
              {step.attachmentName && idx === 0 && (
                <div className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Paperclip className="h-3 w-3" />
                  {step.attachmentName}
                </div>
              )}
            </div>
          ) : null,
        )}
        {isCurrent && !step.actedAt && <p className="mt-2 text-xs font-medium text-info">Awaiting action</p>}
      </div>
    </li>
  );
}

export function ApprovalTrail({ steps, currentStepId }: { steps: ApprovalStep[]; currentStepId?: string }) {
  const visible = steps.filter((s) => s.status !== "skipped" || Boolean(s.comment) || Boolean(s.actionHistory?.length));
  if (!visible.length) return <p className="text-sm text-muted-foreground">No approvers assigned.</p>;
  return (
    <TooltipProvider>
      <ol className="relative space-y-4 border-l border-border/70 pl-6">
        {visible.map((s) => (
          <ApprovalStepItem key={s.id} step={s} currentStepId={currentStepId} />
        ))}
      </ol>
    </TooltipProvider>
  );
}
