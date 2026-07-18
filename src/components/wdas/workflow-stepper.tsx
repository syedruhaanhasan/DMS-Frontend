import type { ApprovalStep } from "@/lib/wdas/types";
import { useUserById } from "@/lib/wdas/users-context";
import { absTime } from "@/lib/wdas/format";
import { cn } from "@/lib/utils";
import { Check, X, RotateCcw, Clock, MessageSquare } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

export interface WorkflowStepperUser {
  id: string;
  name: string;
  designation?: string;
}

interface Props {
  steps: ApprovalStep[];
  currentStepId?: string;
  /** Optional override when users aren't in context (design previews) */
  resolveUser?: (id: string) => WorkflowStepperUser | undefined;
  className?: string;
  compact?: boolean;
}

function StepNode({
  step,
  user,
  isCurrent,
  isLast,
  compact,
}: {
  step: ApprovalStep;
  user?: WorkflowStepperUser;
  isCurrent: boolean;
  isLast: boolean;
  compact?: boolean;
}) {
  const done = step.status === "approved";
  const rejected = step.status === "rejected";
  const returned = step.status === "returned";
  const upcoming = step.status === "pending" && !isCurrent;

  const dotCls = done
    ? "border-success bg-success text-success-foreground"
    : rejected
      ? "border-destructive bg-destructive text-destructive-foreground"
      : returned
        ? "border-warning bg-warning text-warning-foreground"
        : isCurrent
          ? "border-primary bg-primary text-primary-foreground ring-4 ring-primary/15 shadow-sm"
          : "border-border bg-card text-muted-foreground";

  const Icon = done ? Check : rejected ? X : returned ? RotateCcw : Clock;

  return (
    <li
      className={cn("flex min-w-[8rem] flex-1 items-start", !isLast && "flex-[1.2]")}
      aria-current={isCurrent ? "step" : undefined}
    >
      <div className="flex min-w-0 flex-1 flex-col items-center">
        <div className="flex w-full items-center">
          <div
            className={cn(
              "flex shrink-0 items-center justify-center rounded-full border-2",
              compact ? "h-7 w-7" : "h-9 w-9",
              dotCls,
            )}
            aria-hidden
          >
            <Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
          </div>
          {!isLast && (
            <div
              className={cn(
                "mx-1 h-0.5 min-w-[1rem] flex-1 rounded-full",
                done
                  ? "bg-success/50"
                  : isCurrent
                    ? "bg-gradient-to-r from-primary/50 to-border"
                    : "bg-border",
              )}
              aria-hidden
            />
          )}
        </div>
        <div className={cn("mt-2.5 w-full text-left", compact ? "max-w-[7rem]" : "max-w-[9rem]")}>
          <p
            className={cn(
              "truncate text-xs font-semibold",
              isCurrent && "text-primary",
              upcoming ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {user?.name ?? "—"}
          </p>
          {!compact && user?.designation && (
            <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{user.designation}</p>
          )}
          {step.actedAt && (
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {new Date(step.actedAt).toLocaleDateString("en-PK", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </TooltipTrigger>
              <TooltipContent>{absTime(step.actedAt)}</TooltipContent>
            </Tooltip>
          )}
          {isCurrent && !step.actedAt && (
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
              Current approval
            </p>
          )}
          {step.comment && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="mt-1 inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                  <MessageSquare className="h-2.5 w-2.5" aria-hidden />
                  Comment
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">{step.comment}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </li>
  );
}

/** Horizontal workflow tracker — current step highlighted, completed show timestamp + comment icon. */
export function WorkflowStepper({ steps, currentStepId, resolveUser, className, compact }: Props) {
  const sorted = [...steps].sort((a, b) => a.order - b.order);

  return (
    <WorkflowStepperInner
      steps={sorted}
      currentStepId={currentStepId}
      resolveUser={resolveUser}
      className={className}
      compact={compact}
    />
  );
}

function WorkflowStepperInner({
  steps,
  currentStepId,
  resolveUser,
  className,
  compact,
}: Props & { steps: ApprovalStep[] }) {
  return (
    <TooltipProvider>
      <nav aria-label="Approval workflow progress" className={cn("w-full", className)}>
        <ol className="flex w-full items-start gap-0 overflow-x-auto px-1 pb-2">
          {steps.map((step, i) => (
            <StepNodeWithUser
              key={step.id}
              step={step}
              isCurrent={step.id === currentStepId}
              isLast={i === steps.length - 1}
              resolveUser={resolveUser}
              compact={compact}
            />
          ))}
        </ol>
      </nav>
    </TooltipProvider>
  );
}

function StepNodeWithUser({
  step,
  isCurrent,
  isLast,
  resolveUser,
  compact,
}: {
  step: ApprovalStep;
  isCurrent: boolean;
  isLast: boolean;
  resolveUser?: (id: string) => WorkflowStepperUser | undefined;
  compact?: boolean;
}) {
  const ctxUser = useUserById(step.approverId);
  const user =
    resolveUser?.(step.approverId) ??
    (ctxUser
      ? { id: ctxUser.id, name: ctxUser.name, designation: ctxUser.designation }
      : undefined);

  return (
    <StepNode step={step} user={user} isCurrent={isCurrent} isLast={isLast} compact={compact} />
  );
}
