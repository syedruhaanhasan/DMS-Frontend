import { Link } from "@tanstack/react-router";
import type { Document } from "@/lib/wdas/types";
import { StatusBadge, SlaBadge, PriorityBadge } from "./badges";
import { formatPKR, relTime } from "@/lib/wdas/format";
import { Button } from "@/components/ui/button";
import { Check, X, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface DocumentCardProps {
  doc: Pick<
    Document,
    "id" | "refId" | "subject" | "amount" | "priority" | "sla" | "status" | "daysPending" | "createdAt" | "workflowName"
  > & { currentStep?: string; ownerName?: string };
  variant?: "card" | "row";
  showActions?: boolean;
  onApprove?: () => void;
  onReject?: () => void;
  className?: string;
}

/** Document summary card or compact row for dashboards and search results. */
export function DocumentCard({
  doc,
  variant = "card",
  showActions,
  onApprove,
  onReject,
  className,
}: DocumentCardProps) {

  if (variant === "row") {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center gap-3 border-b border-border/60 px-4 py-3 transition-colors hover:bg-accent/30",
          className,
        )}
      >
        <div className="min-w-0 flex-1">
          <Link to="/documents/$id" params={{ id: doc.id }} className="font-medium text-primary hover:underline">
            {doc.subject}
          </Link>
          <p className="text-xs text-muted-foreground">
            {doc.refId} · {doc.workflowName ?? "—"} · {relTime(doc.createdAt)}
          </p>
        </div>
        <span className="font-mono text-sm">{formatPKR(doc.amount)}</span>
        <PriorityBadge priority={doc.priority} />
        <SlaBadge sla={doc.sla} />
        <StatusBadge status={doc.status} />
        {showActions && doc.status === "pending" && (
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" className="text-success" onClick={onApprove} aria-label="Approve">
              <Check className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={onReject} aria-label="Reject">
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <article
      className={cn(
        "rounded-xl border border-border/70 bg-card p-4 transition-colors hover:border-border",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">{doc.refId}</p>
          <h3 className="mt-0.5 truncate text-sm font-semibold text-foreground">{doc.subject}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {doc.workflowName ?? "—"}
            {doc.currentStep && <> · Step: {doc.currentStep}</>}
          </p>
        </div>
        <Button asChild variant="ghost" size="icon" className="shrink-0">
          <Link to="/documents/$id" params={{ id: doc.id }} aria-label="Open document">
            <ExternalLink className="h-4 w-4" />
          </Link>
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-medium">{formatPKR(doc.amount)}</span>
        <PriorityBadge priority={doc.priority} />
        <SlaBadge sla={doc.sla} />
        <StatusBadge status={doc.status} />
        <span className="text-xs text-muted-foreground">{doc.daysPending}d pending</span>
      </div>
      {showActions && doc.status === "pending" && (
        <div className="mt-3 flex gap-2 border-t border-border/60 pt-3">
          <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90" onClick={onApprove}>
            <Check className="mr-1 h-3.5 w-3.5" /> Approve
          </Button>
          <Button size="sm" variant="destructive" onClick={onReject}>
            <X className="mr-1 h-3.5 w-3.5" /> Reject
          </Button>
        </div>
      )}
    </article>
  );
}
