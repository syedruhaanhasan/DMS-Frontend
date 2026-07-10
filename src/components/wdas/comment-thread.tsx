import { cn } from "@/lib/utils";
import { absTime } from "@/lib/wdas/format";
import { Check, X, RotateCcw, Send, MessageSquare } from "lucide-react";

export type CommentAction = "submitted" | "approved" | "rejected" | "returned" | "comment";

export interface CommentEntry {
  id: string;
  author: string;
  role?: string;
  timestamp: string;
  body: string;
  action?: CommentAction;
  attachmentName?: string;
}

const ACTION_META: Record<CommentAction, { icon: typeof Check; color: string; label: string }> = {
  submitted: { icon: Send, color: "text-info", label: "Submitted" },
  approved: { icon: Check, color: "text-success", label: "Approved" },
  rejected: { icon: X, color: "text-destructive", label: "Rejected" },
  returned: { icon: RotateCcw, color: "text-warning", label: "Returned" },
  comment: { icon: MessageSquare, color: "text-muted-foreground", label: "Comment" },
};

interface Props {
  comments: CommentEntry[];
  className?: string;
}

/** Chronological comment thread with approver actions and timestamps. */
export function CommentThread({ comments, className }: Props) {
  const sorted = [...comments].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  if (!sorted.length) {
    return <p className="text-sm text-muted-foreground">No comments yet.</p>;
  }

  return (
    <ol className={cn("space-y-4", className)} aria-label="Approval comments">
      {sorted.map((c) => {
        const meta = ACTION_META[c.action ?? "comment"];
        const Icon = meta.icon;
        return (
          <li key={c.id} className="relative pl-8">
            <span
              className={cn(
                "absolute left-0 top-0.5 flex h-6 w-6 items-center justify-center rounded-full border bg-card",
                meta.color,
              )}
              aria-hidden
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="rounded-lg border border-border/70 bg-card/80 p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <span className="text-sm font-semibold text-foreground">{c.author}</span>
                  {c.role && <span className="ml-1.5 text-xs text-muted-foreground">· {c.role}</span>}
                </div>
                <time className="text-xs text-muted-foreground" dateTime={c.timestamp}>
                  {absTime(c.timestamp)}
                </time>
              </div>
              {c.action && c.action !== "comment" && (
                <span className={cn("mt-1 inline-block text-[10px] font-medium uppercase tracking-wide", meta.color)}>
                  {meta.label}
                </span>
              )}
              <p className="mt-2 text-sm leading-relaxed text-foreground/90">{c.body}</p>
              {c.attachmentName && (
                <p className="mt-2 text-xs text-muted-foreground">Attachment: {c.attachmentName}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
