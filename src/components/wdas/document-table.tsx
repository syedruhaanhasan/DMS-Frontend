import { Link } from "@tanstack/react-router";
import type { Document } from "@/lib/wdas/types";
import { useSession } from "@/lib/wdas/role-context";
import { useUserById } from "@/lib/wdas/users-context";
import { StatusBadge, SlaBadge, PriorityBadge } from "./badges";
import { formatPKR, relTime, absTime } from "@/lib/wdas/format";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, Check, FileText, MessageSquare, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ForceReassignButton } from "./force-reassign-dialog";

interface Props {
  docs: Document[];
  showStatus?: boolean;
  showActions?: "approver" | "none";
  /** Show workflow actions (approve/reject/return/comment) from History API. */
  showHistoryActions?: boolean;
  /** Show whether the current approver has opened (read) the document. */
  showReadStatus?: boolean;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}

export function DocumentTable({
  docs,
  showStatus,
  showActions = "none",
  showHistoryActions,
  showReadStatus,
  onApprove,
  onReject,
}: Props) {
  return (
    <TooltipProvider>
      <Table className="min-w-[860px]">
        <TableHeader>
          <TableRow className="border-border/70 bg-muted/30 hover:bg-muted/30">
            {showActions === "approver" && (
              <TableHead className="w-16 text-center">Queue</TableHead>
            )}
            <TableHead>Document</TableHead>
            <TableHead>Requester</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Priority</TableHead>
            {!showHistoryActions && <TableHead>SLA</TableHead>}
            {!showHistoryActions && <TableHead>Waiting</TableHead>}
            {showStatus && <TableHead>Status</TableHead>}
            {showHistoryActions && <TableHead>User actions</TableHead>}
            <TableHead className="text-right">Open</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {docs.map((d, index) => (
            <DocumentTableRow
              key={d.id}
              doc={d}
              queuePosition={index + 1}
              showStatus={showStatus}
              showActions={showActions}
              showHistoryActions={showHistoryActions}
              showReadStatus={showReadStatus}
              onApprove={onApprove}
              onReject={onReject}
            />
          ))}
        </TableBody>
      </Table>
    </TooltipProvider>
  );
}

function DocumentTableRow({
  doc: d,
  queuePosition,
  showStatus,
  showActions,
  showHistoryActions,
  showReadStatus,
  onApprove,
  onReject,
}: {
  doc: Document;
  queuePosition: number;
  showStatus?: boolean;
  showActions?: "approver" | "none";
  showHistoryActions?: boolean;
  showReadStatus?: boolean;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}) {
  const { user } = useSession();
  const owner = useUserById(d.ownerId);
  const ownerLabel = d.ownerName ?? owner?.name ?? "—";
  const deptLabel = owner?.department ?? "—";
  const isOwner = !!user.id && d.ownerId === user.id;
  const linkTo =
    isOwner || d.status === "draft"
      ? "/documents/$id"
      : d.status === "pending" || d.status === "pending_reviewer"
        ? "/documents/$id/review"
        : "/documents/$id";

  return (
    <TableRow className="group border-border/60 hover:bg-primary/[0.035]">
      {showActions === "approver" && (
        <TableCell className="text-center">
          <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-md border border-border bg-muted/50 px-1.5 font-mono text-xs font-semibold text-muted-foreground">
            {String(queuePosition).padStart(2, "0")}
          </span>
        </TableCell>
      )}
      <TableCell className="max-w-sm py-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/[0.07] text-primary">
            <FileText className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <Link
              to={linkTo}
              params={{ id: d.id }}
              className="line-clamp-1 font-semibold text-foreground transition-colors hover:text-primary"
            >
              {d.subject}
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              {d.refId && <span className="font-mono">{d.refId}</span>}
              {d.refId && <span aria-hidden>·</span>}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>Received {relTime(d.submittedAt ?? d.createdAt)}</span>
                </TooltipTrigger>
                <TooltipContent>{absTime(d.submittedAt ?? d.createdAt)}</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <p className="text-sm font-medium">{ownerLabel}</p>
        <p className="text-xs text-muted-foreground">{deptLabel}</p>
      </TableCell>
      <TableCell className="text-right font-mono text-sm">{formatPKR(d.amount)}</TableCell>
      <TableCell>
        <PriorityBadge priority={d.priority} />
      </TableCell>
      {!showHistoryActions && (
        <TableCell>
          <SlaBadge sla={d.sla} />
        </TableCell>
      )}
      {!showHistoryActions && (
        <TableCell>
          <span className="font-mono text-sm font-medium">{d.daysPending}d</span>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">pending</p>
        </TableCell>
      )}
      {showStatus && (
        <TableCell>
          <div className="flex flex-col items-start gap-1">
            <StatusBadge status={d.status} />
            {showReadStatus && d.status === "pending" && (
              <span
                className={
                  d.seenByApprover
                    ? "inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                    : "inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                }
              >
                {d.seenByApprover ? "Read by approver" : "Unread"}
              </span>
            )}
          </div>
        </TableCell>
      )}
      {showHistoryActions && (
        <TableCell className="max-w-xs">
          {d.steps.length === 0 ? (
            <span className="text-xs text-muted-foreground">No recorded actions</span>
          ) : (
            <ul className="space-y-1.5">
              {d.steps.map((step) => (
                <li key={step.id} className="rounded-md border border-border/70 bg-muted/30 px-2 py-1.5 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-foreground">
                      {step.actorName ?? "User"}
                    </span>
                    <span className="rounded-full bg-background px-1.5 py-0.5 font-medium text-muted-foreground">
                      {step.actionType ?? step.status}
                    </span>
                  </div>
                  {step.comment ? (
                    <p className="mt-0.5 line-clamp-2 text-muted-foreground">{step.comment}</p>
                  ) : null}
                  {step.actedAt ? (
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{absTime(step.actedAt)}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </TableCell>
      )}
      <TableCell className="text-right">
        <div className="flex justify-end gap-1.5">
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            <Link to={linkTo} params={{ id: d.id }}>
              Open <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
          {showActions === "approver" && d.status === "pending" && (
            <>
              <Button size="sm" onClick={() => onApprove?.(d.id)}>
                <Check className="h-3.5 w-3.5" /> Approve
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => onReject?.(d.id)}
                aria-label={`Reject ${d.subject}`}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
              <CommentPopover docId={d.id} />
            </>
          )}
          {d.status === "pending" && <ForceReassignButton doc={d} />}
        </div>
      </TableCell>
    </TableRow>
  );
}

function CommentPopover({ docId }: { docId: string }) {
  const [c, setC] = useState("");
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="rounded-full">
          <MessageSquare className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <p className="mb-2 text-sm font-medium">Add comment</p>
        <Textarea
          value={c}
          onChange={(e) => setC(e.target.value)}
          rows={3}
          placeholder="Note for the record…"
        />
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!c.trim()}
            onClick={() => {
              toast.success("Comment saved");
              setC("");
              setOpen(false);
              void docId;
            }}
          >
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
