import { cn } from "@/lib/utils";
import type { DocStatus, SlaState, Priority } from "@/lib/wdas/types";
import { CheckCircle2, Clock, XCircle, Undo2, Ban, FileEdit, AlertTriangle, ShieldCheck, ArrowUp } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

const STATUS_CLASSES: Record<DocStatus, string> = {
  draft: "bg-neutral/40 text-neutral-foreground border-border",
  pending_reviewer: "bg-violet-500/10 text-violet-700 border-violet-500/25 dark:text-violet-300",
  pending_creator_send: "bg-amber-500/10 text-amber-800 border-amber-500/30 dark:text-amber-300",
  pending: "bg-info/10 text-info border-info/25",
  ready_to_finalize: "bg-primary/15 text-foreground border-primary/45",
  approved: "bg-success/10 text-success border-success/25",
  rejected: "bg-destructive/10 text-destructive border-destructive/25",
  returned: "bg-warning/15 text-warning-foreground border-warning/35",
  cancelled: "bg-muted text-muted-foreground border-border line-through",
};

const STATUS_LABEL: Record<DocStatus, string> = {
  draft: "Draft",
  pending_reviewer: "With Reviewer",
  pending_creator_send: "Ready to Send",
  pending: "In Progress",
  ready_to_finalize: "Ready to Finalize",
  approved: "Approved",
  rejected: "Rejected",
  returned: "Returned",
  cancelled: "Cancelled",
};

const STATUS_ICON: Record<DocStatus, ComponentType<SVGProps<SVGSVGElement>>> = {
  draft: FileEdit,
  pending_reviewer: Clock,
  pending_creator_send: ShieldCheck,
  pending: Clock,
  ready_to_finalize: ShieldCheck,
  approved: CheckCircle2,
  rejected: XCircle,
  returned: Undo2,
  cancelled: Ban,
};

export function StatusBadge({ status, className }: { status: DocStatus; className?: string }) {
  const Icon = STATUS_ICON[status];
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
      STATUS_CLASSES[status], className,
    )}>
      <Icon className="h-3 w-3" />
      {STATUS_LABEL[status]}
    </span>
  );
}

const SLA_CLASSES: Record<SlaState, string> = {
  on_time: "bg-success/10 text-success border-success/25",
  at_risk: "bg-warning/15 text-warning-foreground border-warning/35",
  overdue: "bg-destructive/10 text-destructive border-destructive/25",
};
const SLA_LABEL: Record<SlaState, string> = { on_time: "On time", at_risk: "At risk", overdue: "Overdue" };
const SLA_ICON: Record<SlaState, ComponentType<SVGProps<SVGSVGElement>>> = {
  on_time: ShieldCheck, at_risk: AlertTriangle, overdue: AlertTriangle,
};

export function SlaBadge({ sla, className }: { sla: SlaState; className?: string }) {
  const Icon = SLA_ICON[sla];
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
      SLA_CLASSES[sla], className,
    )}>
      <Icon className="h-3 w-3" />
      {SLA_LABEL[sla]}
    </span>
  );
}

const PRIORITY_CLASSES: Record<Priority, string> = {
  Normal: "bg-muted text-muted-foreground border-border",
  Urgent: "bg-warning/15 text-warning-foreground border-warning/35",
  Critical: "bg-destructive/10 text-destructive border-destructive/25",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
      PRIORITY_CLASSES[priority],
    )}>
      {priority !== "Normal" && <ArrowUp className="h-3 w-3" />}
      {priority}
    </span>
  );
}
