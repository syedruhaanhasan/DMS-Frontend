import { cn } from "@/lib/utils";
import { absTime } from "@/lib/wdas/format";
import { Check, X, RotateCcw, Send, MessageSquare, Eye } from "lucide-react";

export type CommentAction = "submitted" | "approved" | "rejected" | "returned" | "comment" | "review";

export interface CommentEntry {
  id: string;
  author: string;
  role?: string;
  timestamp: string;
  body: string;
  selectedText?: string;
  action?: CommentAction;
  attachmentName?: string;
}

const ACTION_META: Record<CommentAction, { icon: typeof Check; color: string; label: string }> = {
  submitted: { icon: Send, color: "text-info", label: "Submitted" },
  approved: { icon: Check, color: "text-success", label: "Approved" },
  rejected: { icon: X, color: "text-destructive", label: "Rejected" },
  returned: { icon: RotateCcw, color: "text-warning", label: "Returned" },
  comment: { icon: MessageSquare, color: "text-muted-foreground", label: "Comment" },
  review: { icon: Eye, color: "text-violet-600", label: "Review complete" },
};

interface Props {
  comments: CommentEntry[];
  className?: string;
  onQuoteClick?: (selectedText: string) => void;
}

/** Chronological comment thread with approver actions and timestamps. */
export function CommentThread({ comments, className, onQuoteClick }: Props) {
  const sorted = [...comments].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  if (!sorted.length) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center">
        <MessageSquare className="mx-auto mb-2 h-5 w-5 text-muted-foreground/60" />
        <p className="text-sm font-medium">No review notes</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Workflow comments will appear here.</p>
      </div>
    );
  }

  return (
    <ol
      className={cn(
        "relative space-y-5 before:absolute before:bottom-3 before:left-3 before:top-3 before:w-px before:bg-border",
        className,
      )}
      aria-label="Approval comments"
    >
      {sorted.map((c) => {
        const meta = ACTION_META[c.action ?? "comment"];
        const Icon = meta.icon;
        return (
          <li key={c.id} className="relative pl-10">
            <span
              className={cn(
                "absolute left-0 top-0.5 z-10 flex h-6 w-6 items-center justify-center rounded-full border bg-card shadow-sm",
                meta.color,
              )}
              aria-hidden
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="rounded-lg border border-border/70 bg-card p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <span className="text-sm font-semibold text-foreground">{c.author}</span>
                  {c.role && (
                    <span className="ml-1.5 text-xs text-muted-foreground">· {c.role}</span>
                  )}
                </div>
                <time className="text-xs text-muted-foreground" dateTime={c.timestamp}>
                  {absTime(c.timestamp)}
                </time>
              </div>
              {c.action && c.action !== "comment" && (
                <span
                  className={cn(
                    "mt-1 inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                    meta.color,
                  )}
                >
                  {meta.label}
                </span>
              )}
              <p className="mt-2.5 text-sm leading-relaxed text-foreground/90">{c.body}</p>
              {c.selectedText && (
                <button
                  type="button"
                  className="mt-3 block w-full border-l-2 border-primary/60 bg-primary/5 px-3 py-2 text-left text-xs italic text-muted-foreground hover:bg-primary/10"
                  onClick={() => onQuoteClick?.(c.selectedText!)}
                  title="Locate highlighted text in the document"
                >
                  “{c.selectedText}”
                </button>
              )}
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
