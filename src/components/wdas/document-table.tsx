import { Link } from "@tanstack/react-router";
import type { Document } from "@/lib/wdas/types";
import { useSession } from "@/lib/wdas/role-context";
import { useUserById } from "@/lib/wdas/users-context";
import { StatusBadge, SlaBadge, PriorityBadge } from "./badges";
import { formatPKR, relTime, absTime } from "@/lib/wdas/format";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Check, X, MessageSquare, ExternalLink } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ForceReassignButton } from "./force-reassign-dialog";

interface Props {
  docs: Document[];
  showStatus?: boolean;
  showActions?: "approver" | "none";
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}

export function DocumentTable({ docs, showStatus, showActions = "none", onApprove, onReject }: Props) {
  return (
    <TooltipProvider>
      <Table className="min-w-[860px]">
        <TableHeader>
          <TableRow>
            <TableHead>Subject</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Department</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>SLA</TableHead>
            <TableHead className="text-right">Days Pending</TableHead>
            {showStatus && <TableHead>Status</TableHead>}
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {docs.map((d) => (
            <DocumentTableRow
              key={d.id}
              doc={d}
              showStatus={showStatus}
              showActions={showActions}
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
  showStatus,
  showActions,
  onApprove,
  onReject,
}: {
  doc: Document;
  showStatus?: boolean;
  showActions?: "approver" | "none";
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
      : d.status === "pending"
        ? "/documents/$id/review"
        : "/documents/$id";

  return (
    <TableRow className="cursor-pointer hover:bg-accent/40">
      <TableCell className="max-w-xs">
        <Link to={linkTo} params={{ id: d.id }} className="font-medium text-primary transition-colors hover:text-primary-hover hover:underline">
          {d.subject}
        </Link>
        {d.refId && <p className="text-xs text-muted-foreground">{d.refId}</p>}
        <Tooltip>
          <TooltipTrigger asChild>
            <p className="text-xs text-muted-foreground">Created {relTime(d.createdAt)}</p>
          </TooltipTrigger>
          <TooltipContent>{absTime(d.createdAt)}</TooltipContent>
        </Tooltip>
      </TableCell>
      <TableCell>{ownerLabel}</TableCell>
      <TableCell>{deptLabel}</TableCell>
      <TableCell className="text-right font-mono text-sm">{formatPKR(d.amount)}</TableCell>
      <TableCell><PriorityBadge priority={d.priority} /></TableCell>
      <TableCell><SlaBadge sla={d.sla} /></TableCell>
      <TableCell className="text-right">{d.daysPending}</TableCell>
      {showStatus && <TableCell><StatusBadge status={d.status} /></TableCell>}
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button asChild variant="ghost" size="sm" className="rounded-full">
            <Link to={linkTo} params={{ id: d.id }}><ExternalLink className="h-3.5 w-3.5" /></Link>
          </Button>
          {showActions === "approver" && d.status === "pending" && (
            <>
              <Button variant="ghost" size="sm" className="rounded-full text-success hover:bg-success/10 hover:text-success" onClick={() => onApprove?.(d.id)}><Check className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="sm" className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => onReject?.(d.id)}><X className="h-3.5 w-3.5" /></Button>
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
        <Button variant="ghost" size="sm" className="rounded-full"><MessageSquare className="h-3.5 w-3.5" /></Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <p className="mb-2 text-sm font-medium">Add comment</p>
        <Textarea value={c} onChange={(e) => setC(e.target.value)} rows={3} placeholder="Note for the record…" />
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
          <Button size="sm" disabled={!c.trim()} onClick={() => { toast.success("Comment saved"); setC(""); setOpen(false); void docId; }}>Save</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
