import { cn } from "@/lib/utils";
import { Eye, FilePenLine, GripVertical, UserRoundCheck, Users } from "lucide-react";
import { useState } from "react";
import type { Document, User } from "@/lib/wdas/types";

export type ApprovalFlowNode = {
  id: string;
  label: string;
  sub?: string;
  role: "creator" | "approver" | "reviewer";
  /**
   * For reviewers: the id of the node (creator or an approver) that added them.
   * The reviewer card renders immediately after that node. Defaults to the creator.
   */
  addedBy?: string;
};

/**
 * Builds sequence-chart nodes from a live document: creator, then the approvers in
 * step order, with each reviewer attached to whoever added them (creator or approver).
 */
export function buildDocumentFlowNodes(doc: Document, users: User[]): ApprovalFlowNode[] {
  const creatorNodeId = `creator-${doc.ownerId}`;
  const approverNodeId = (approverId: string) => `approver-${approverId}`;
  const ownerUser = users.find((u) => u.id === doc.ownerId);

  const nodes: ApprovalFlowNode[] = [
    {
      id: creatorNodeId,
      label: doc.ownerName ?? ownerUser?.name ?? "Creator",
      sub: ownerUser?.designation || ownerUser?.department || "Document owner",
      role: "creator",
    },
  ];

  const seenApprovers = new Set<string>();
  for (const step of [...doc.steps].sort((a, b) => a.order - b.order)) {
    if (!step.approverId || seenApprovers.has(step.approverId)) continue;
    seenApprovers.add(step.approverId);
    const u = users.find((x) => x.id === step.approverId);
    nodes.push({
      id: approverNodeId(step.approverId),
      label: u?.name ?? step.approverId,
      sub: u?.designation || u?.department || "Approver",
      role: "approver",
    });
  }

  for (const reviewer of doc.reviewers ?? []) {
    const addedBy =
      reviewer.addedById && reviewer.addedById !== doc.ownerId
        ? approverNodeId(reviewer.addedById)
        : creatorNodeId;
    const u = reviewer.userId ? users.find((x) => x.id === reviewer.userId) : undefined;
    nodes.push({
      id: `reviewer-${reviewer.id}`,
      label: reviewer.name || u?.name || "Reviewer",
      sub: u?.designation || u?.department || "Reviewer",
      role: "reviewer",
      addedBy,
    });
  }

  return nodes;
}

interface Props {
  nodes: ApprovalFlowNode[];
  /** Sequential shows arrows; parallel clusters approvers. */
  mode?: "sequential" | "parallel";
  /** When provided, sequential cards become draggable to reorder (creator excluded). */
  onReorder?: (fromId: string, toId: string) => void;
  className?: string;
}

/** Live creator → approvers sequence chart for the New Document screen. */
export function ApprovalFlowChart({ nodes, mode = "sequential", onReorder, className }: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  if (!nodes.length) {
    return (
      <div
        className={cn(
          "rounded-md border border-dashed bg-muted/30 p-4 text-center text-xs text-muted-foreground",
          className,
        )}
      >
        Select a workflow above — the sequence chart will build here.
      </div>
    );
  }

  const creator = nodes.find((n) => n.role === "creator");
  const approvers = nodes.filter((n) => n.role === "approver");
  const reviewers = nodes.filter((n) => n.role === "reviewer");

  // Reviewers render right after whoever added them (creator or a specific approver).
  const reviewersAddedBy = (parentId: string | undefined) =>
    reviewers.filter((r) => (r.addedBy ?? creator?.id) === parentId);
  const creatorReviewers = creator ? reviewersAddedBy(creator.id) : [];

  if (mode === "parallel" && approvers.length > 0) {
    const clusterReviewers = reviewers.filter((r) => !creatorReviewers.includes(r));
    return (
      <div className={cn("space-y-3 rounded-lg border border-amber-200 bg-white p-4 dark:border-amber-400/20 dark:bg-card", className)} aria-label="Sequence chart">
        <div className="flex items-center gap-2 text-xs font-medium text-amber-800 dark:text-amber-300">
          <Users className="h-3.5 w-3.5" />
          Parallel routing — all approvers receive the document together
        </div>
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-stretch sm:justify-center sm:gap-3">
          {creator && <FlowCard node={creator} index={0} />}
          {creatorReviewers.map((n) => (
            <FlowCard key={n.id} node={n} index={0} parallel />
          ))}
          {creator && (approvers.length > 0 || clusterReviewers.length > 0) && (
            <span className="hidden self-center text-muted-foreground sm:inline" aria-hidden>
              →
            </span>
          )}
          <div className="flex min-w-0 flex-1 flex-wrap items-stretch justify-center gap-2">
            {approvers.map((n, i) => (
              <FlowCard key={n.id} node={n} index={i + 1} parallel />
            ))}
            {clusterReviewers.map((n) => (
              <FlowCard key={n.id} node={n} index={0} parallel />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Sequential order: creator → (creator's reviewers) → approver 1 → (its reviewers) → …
  const ordered: ApprovalFlowNode[] = [];
  if (creator) {
    ordered.push(creator, ...creatorReviewers);
  }
  for (const approver of approvers) {
    ordered.push(approver, ...reviewersAddedBy(approver.id));
  }
  const placed = new Set(ordered.map((n) => n.id));
  ordered.push(...reviewers.filter((r) => !placed.has(r.id)));
  const sequence = ordered;
  const canReorder = Boolean(onReorder);

  return (
    <div className={cn("space-y-3 rounded-lg border border-amber-200 bg-white p-4 dark:border-amber-400/20 dark:bg-card", className)} aria-label="Sequence chart">
      <div className="flex items-center gap-2 text-xs font-medium text-amber-800 dark:text-amber-300">
        <UserRoundCheck className="h-3.5 w-3.5" />
        Sequential routing — approvers act in order, reviewers receive a copy
      </div>
      {canReorder && sequence.length > 2 && (
        <p className="text-[11px] text-muted-foreground">Drag a card onto another to change the order.</p>
      )}
      <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1">
        {sequence.map((n, i) => {
          const stepIndex = approvers.findIndex((a) => a.id === n.id);
          const draggable = canReorder && n.role !== "creator";
          const isDragging = dragId === n.id;
          const isOver = overId === n.id && dragId !== null && dragId !== n.id;
          return (
            <div key={n.id} className="flex items-center gap-2">
              <div
                draggable={draggable}
                onDragStart={
                  draggable
                    ? (e) => {
                        setDragId(n.id);
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", n.id);
                      }
                    : undefined
                }
                onDragOver={
                  draggable
                    ? (e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        if (overId !== n.id) setOverId(n.id);
                      }
                    : undefined
                }
                onDragLeave={
                  draggable
                    ? () => {
                        if (overId === n.id) setOverId(null);
                      }
                    : undefined
                }
                onDrop={
                  draggable
                    ? (e) => {
                        e.preventDefault();
                        const from = e.dataTransfer.getData("text/plain") || dragId;
                        if (from && from !== n.id) onReorder?.(from, n.id);
                        setDragId(null);
                        setOverId(null);
                      }
                    : undefined
                }
                onDragEnd={
                  draggable
                    ? () => {
                        setDragId(null);
                        setOverId(null);
                      }
                    : undefined
                }
                className={cn(
                  "rounded-md transition-opacity",
                  isDragging && "opacity-50",
                  isOver && "ring-2 ring-amber-400",
                )}
              >
                <FlowCard node={n} index={stepIndex >= 0 ? stepIndex + 1 : i} draggable={draggable} />
              </div>
              {i < sequence.length - 1 && (
                <span className="shrink-0 text-sm text-muted-foreground" aria-hidden>
                  →
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FlowCard({
  node,
  index,
  parallel,
  draggable,
}: {
  node: ApprovalFlowNode;
  index: number;
  parallel?: boolean;
  draggable?: boolean;
}) {
  const isCreator = node.role === "creator";
  const isReviewer = node.role === "reviewer";
  return (
    <div
      className={cn(
        "min-w-[140px] max-w-[200px] rounded-md border px-3 py-2 shadow-sm",
        isCreator
          ? "border-stone-800 bg-stone-950 text-white"
          : isReviewer
            ? "border-stone-300 bg-stone-100 dark:border-stone-700 dark:bg-stone-800"
            : "border-amber-300 bg-amber-50 dark:border-amber-400/25 dark:bg-amber-400/10",
        parallel && !isCreator && "flex-1 basis-[140px]",
        draggable && "cursor-grab active:cursor-grabbing",
      )}
    >
      <div className="mb-1 flex items-center gap-1.5">
        {draggable && (
          <GripVertical className={cn("h-3 w-3 shrink-0", isCreator ? "text-stone-400" : "text-muted-foreground")} aria-hidden />
        )}
        <span
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold",
            isCreator
              ? "bg-amber-400 text-stone-950"
              : isReviewer
                ? "bg-stone-600 text-stone-100"
                : "bg-stone-900 text-amber-100",
          )}
        >
          {isCreator ? <FilePenLine className="h-3 w-3" /> : isReviewer ? <Eye className="h-3 w-3" /> : index}
        </span>
        <span
          className={cn(
            "text-[10px] font-medium uppercase tracking-wide",
            isCreator ? "text-stone-300" : isReviewer ? "text-stone-500 dark:text-stone-400" : "text-amber-800 dark:text-amber-300",
          )}
        >
          {isCreator ? "Creator" : isReviewer ? "Reviewer" : parallel ? "Approver" : `Step ${index}`}
        </span>
      </div>
      <p className={cn("truncate text-xs font-semibold", isCreator ? "text-white" : "text-stone-900 dark:text-stone-100")}>{node.label}</p>
      {node.sub && <p className={cn("mt-0.5 truncate text-[11px]", isCreator ? "text-stone-300" : "text-muted-foreground")}>{node.sub}</p>}
    </div>
  );
}
