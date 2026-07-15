import { cn } from "@/lib/utils";
import { FilePenLine, UserRoundCheck, Users } from "lucide-react";

export type ApprovalFlowNode = {
  id: string;
  label: string;
  sub?: string;
  role: "creator" | "approver";
};

interface Props {
  nodes: ApprovalFlowNode[];
  /** Sequential shows arrows; parallel clusters approvers. */
  mode?: "sequential" | "parallel";
  className?: string;
}

/** Live creator → approvers flow chart for the New Document screen. */
export function ApprovalFlowChart({ nodes, mode = "sequential", className }: Props) {
  if (!nodes.length) {
    return (
      <div
        className={cn(
          "rounded-md border border-dashed bg-muted/30 p-4 text-center text-xs text-muted-foreground",
          className,
        )}
      >
        Select approvers above — the approval chart will build here.
      </div>
    );
  }

  const creator = nodes.find((n) => n.role === "creator");
  const approvers = nodes.filter((n) => n.role === "approver");

  if (mode === "parallel" && approvers.length > 0) {
    return (
      <div className={cn("space-y-3 rounded-md border bg-muted/20 p-4", className)} aria-label="Approval flow chart">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          Parallel routing — all approvers receive the document together
        </div>
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-stretch sm:justify-center sm:gap-3">
          {creator && <FlowCard node={creator} index={0} />}
          {creator && approvers.length > 0 && (
            <span className="hidden self-center text-muted-foreground sm:inline" aria-hidden>
              →
            </span>
          )}
          <div className="flex min-w-0 flex-1 flex-wrap items-stretch justify-center gap-2">
            {approvers.map((n, i) => (
              <FlowCard key={n.id} node={n} index={i + 1} parallel />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3 rounded-md border bg-muted/20 p-4", className)} aria-label="Approval flow chart">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <UserRoundCheck className="h-3.5 w-3.5" />
        Sequential routing — each person acts in order
      </div>
      <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1">
        {nodes.map((n, i) => (
          <div key={n.id} className="flex items-center gap-2">
            <FlowCard node={n} index={i} />
            {i < nodes.length - 1 && (
              <span className="shrink-0 text-sm text-muted-foreground" aria-hidden>
                →
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function FlowCard({
  node,
  index,
  parallel,
}: {
  node: ApprovalFlowNode;
  index: number;
  parallel?: boolean;
}) {
  const isCreator = node.role === "creator";
  return (
    <div
      className={cn(
        "min-w-[140px] max-w-[200px] rounded-md border px-3 py-2 shadow-sm",
        isCreator ? "border-info/40 bg-info/10" : "border-border bg-card",
        parallel && !isCreator && "flex-1 basis-[140px]",
      )}
    >
      <div className="mb-1 flex items-center gap-1.5">
        <span
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold",
            isCreator ? "bg-info text-info-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          {isCreator ? <FilePenLine className="h-3 w-3" /> : index}
        </span>
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {isCreator ? "Creator" : parallel ? "Approver" : `Step ${index}`}
        </span>
      </div>
      <p className="truncate text-xs font-semibold text-foreground">{node.label}</p>
      {node.sub && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{node.sub}</p>}
    </div>
  );
}
