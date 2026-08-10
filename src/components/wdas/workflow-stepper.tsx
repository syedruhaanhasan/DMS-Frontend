import type { ApprovalStep, DocumentReviewer } from "@/lib/wdas/types";
import { useUserById } from "@/lib/wdas/users-context";
import { absTime } from "@/lib/wdas/format";
import { cn } from "@/lib/utils";
import { Check, X, RotateCcw, Clock, MessageSquare, Eye, Pause } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

export interface WorkflowStepperUser {
  id: string;
  name: string;
  designation?: string;
}

interface Props {
  steps: ApprovalStep[];
  currentStepId?: string;
  /** Approver- or creator-added reviewers — shown right after the related approver. */
  reviewers?: DocumentReviewer[];
  ownerId?: string;
  /** Optional override when users aren't in context (design previews) */
  resolveUser?: (id: string) => WorkflowStepperUser | undefined;
  className?: string;
  compact?: boolean;
}

type TimelineItem =
  | { kind: "step"; step: ApprovalStep }
  | { kind: "reviewer"; reviewer: DocumentReviewer };

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
  const paused = step.status === "paused";
  const skipped = step.status === "skipped";
  const upcoming = (step.status === "pending" || skipped) && !isCurrent;

  const dotCls = done
    ? "border-success bg-success text-success-foreground"
    : rejected
      ? "border-destructive bg-destructive text-destructive-foreground"
      : returned
        ? "border-warning bg-warning text-warning-foreground"
        : paused
          ? "border-violet-500 bg-violet-500 text-white ring-4 ring-violet-500/15 shadow-sm"
          : isCurrent
            ? "border-primary bg-primary text-primary-foreground ring-4 ring-primary/15 shadow-sm"
            : "border-border bg-card text-muted-foreground";

  const Icon = done ? Check : rejected ? X : returned ? RotateCcw : paused ? Pause : Clock;

  return (
    <li
      className={cn("flex min-w-[8rem] flex-1 items-start", !isLast && "flex-[1.2]")}
      aria-current={isCurrent || paused ? "step" : undefined}
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
                  : isCurrent || paused
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
              (isCurrent || paused) && "text-primary",
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
          {paused && (
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-violet-600">
              Awaiting reviewer
            </p>
          )}
          {rejected && (
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-destructive">
              Rejected
            </p>
          )}
          {skipped && (
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Not reached
            </p>
          )}
          {isCurrent && !step.actedAt && !paused && (
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

function ReviewerNode({
  reviewer,
  user,
  addedByName,
  isLast,
  compact,
}: {
  reviewer: DocumentReviewer;
  user?: WorkflowStepperUser;
  addedByName?: string;
  isLast: boolean;
  compact?: boolean;
}) {
  const done = Boolean(reviewer.reviewedAt);
  return (
    <li className={cn("flex min-w-[8rem] flex-1 items-start", !isLast && "flex-[1.2]")}>
      <div className="flex min-w-0 flex-1 flex-col items-center">
        <div className="flex w-full items-center">
          <div
            className={cn(
              "flex shrink-0 items-center justify-center rounded-full border-2",
              compact ? "h-7 w-7" : "h-9 w-9",
              done
                ? "border-violet-600 bg-violet-600 text-white"
                : "border-violet-300 bg-violet-50 text-violet-700 dark:bg-violet-400/10",
            )}
            aria-hidden
          >
            {done ? <Check className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} /> : <Eye className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />}
          </div>
          {!isLast && <div className="mx-1 h-0.5 min-w-[1rem] flex-1 rounded-full bg-border" aria-hidden />}
        </div>
        <div className={cn("mt-2.5 w-full text-left", compact ? "max-w-[7rem]" : "max-w-[9rem]")}>
          <p className="truncate text-xs font-semibold text-foreground">
            {user?.name ?? reviewer.name}
          </p>
          <p className="mt-0.5 truncate text-[10px] text-violet-700 dark:text-violet-300">
            Reviewer{addedByName ? ` · by ${addedByName}` : ""}
          </p>
          {reviewer.reviewedAt && (
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {new Date(reviewer.reviewedAt).toLocaleDateString("en-PK", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </TooltipTrigger>
              <TooltipContent>{absTime(reviewer.reviewedAt)}</TooltipContent>
            </Tooltip>
          )}
          {!done && (
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-violet-600">
              Pending review
            </p>
          )}
          {reviewer.reviewComment?.trim() && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="mt-1 inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                  <MessageSquare className="h-2.5 w-2.5" aria-hidden />
                  Review note
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">{reviewer.reviewComment}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </li>
  );
}

function buildTimeline(
  steps: ApprovalStep[],
  reviewers: DocumentReviewer[],
  ownerId?: string,
): TimelineItem[] {
  const sorted = [...steps]
    .sort((a, b) => (a.approvalCycle ?? 1) - (b.approvalCycle ?? 1) || a.order - b.order);

  const used = new Set<string>();
  const items: TimelineItem[] = [];

  const creatorReviewers = reviewers.filter(
    (r) => !r.returnWorkflowStepId && (!r.addedById || r.addedById === ownerId),
  );
  for (const reviewer of creatorReviewers) {
    items.push({ kind: "reviewer", reviewer });
    used.add(reviewer.id);
  }

  for (const step of sorted) {
    items.push({ kind: "step", step });
    const linked = reviewers.filter((r) => {
      if (used.has(r.id)) return false;
      if (r.returnWorkflowStepId && r.returnWorkflowStepId === step.id) return true;
      if (!r.returnWorkflowStepId && r.addedById && r.addedById === step.approverId) return true;
      return false;
    });
    for (const reviewer of linked) {
      items.push({ kind: "reviewer", reviewer });
      used.add(reviewer.id);
    }
  }

  for (const reviewer of reviewers) {
    if (!used.has(reviewer.id)) items.push({ kind: "reviewer", reviewer });
  }

  return items;
}

/** Horizontal workflow tracker — approvers + reviewers (with review notes). */
export function WorkflowStepper({
  steps,
  currentStepId,
  reviewers = [],
  ownerId,
  resolveUser,
  className,
  compact,
}: Props) {
  const timeline = buildTimeline(steps, reviewers, ownerId);

  return (
    <TooltipProvider>
      <nav aria-label="Approval workflow progress" className={cn("w-full", className)}>
        <ol className="flex w-full items-start gap-0 overflow-x-auto px-1 pb-2">
          {timeline.map((item, i) => {
            const isLast = i === timeline.length - 1;
            if (item.kind === "reviewer") {
              return (
                <ReviewerNodeWithUser
                  key={`reviewer-${item.reviewer.id}`}
                  reviewer={item.reviewer}
                  isLast={isLast}
                  resolveUser={resolveUser}
                  compact={compact}
                />
              );
            }
            return (
              <StepNodeWithUser
                key={item.step.id}
                step={item.step}
                isCurrent={item.step.id === currentStepId || item.step.status === "paused"}
                isLast={isLast}
                resolveUser={resolveUser}
                compact={compact}
              />
            );
          })}
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

function ReviewerNodeWithUser({
  reviewer,
  isLast,
  resolveUser,
  compact,
}: {
  reviewer: DocumentReviewer;
  isLast: boolean;
  resolveUser?: (id: string) => WorkflowStepperUser | undefined;
  compact?: boolean;
}) {
  const reviewerUser = useUserById(reviewer.userId);
  const addedByUser = useUserById(reviewer.addedById);
  const resolved =
    reviewer.userId && resolveUser ? resolveUser(reviewer.userId) : undefined;
  const user =
    resolved ??
    (reviewer.userId && reviewerUser
      ? { id: reviewerUser.id, name: reviewerUser.name, designation: reviewerUser.designation }
      : undefined);

  return (
    <ReviewerNode
      reviewer={reviewer}
      user={user}
      addedByName={reviewer.addedById ? addedByUser?.name : undefined}
      isLast={isLast}
      compact={compact}
    />
  );
}
