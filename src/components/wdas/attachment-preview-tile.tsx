import type { Attachment } from "@/lib/wdas/types";
import { AttachmentIcon } from "./attachments";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert, Loader2, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  attachment: Attachment;
  onPreview?: (attachment: Attachment) => void;
  className?: string;
}

function ScanIndicator({ status }: { status?: Attachment["scanStatus"] }) {
  if (!status || status === "Clean") {
    return (
      <Badge variant="outline" className="text-[10px] text-success" aria-label="Virus scan: clean">
        <ShieldCheck className="mr-0.5 h-3 w-3" aria-hidden /> Clean
      </Badge>
    );
  }
  if (status === "Pending") {
    return (
      <Badge variant="outline" className="text-[10px] text-warning" aria-label="Virus scan in progress">
        <Loader2 className="mr-0.5 h-3 w-3 animate-spin" aria-hidden /> Scanning
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] text-destructive" aria-label="File quarantined">
      <ShieldAlert className="mr-0.5 h-3 w-3" aria-hidden /> Quarantined
    </Badge>
  );
}

/** Attachment preview tile with file-type icon, scan status, and inline preview action. */
export function AttachmentPreviewTile({ attachment, onPreview, className }: Props) {
  const canPreview = attachment.scanStatus !== "Quarantined";

  return (
    <button
      type="button"
      onClick={() => canPreview && onPreview?.(attachment)}
      disabled={!canPreview}
      className={cn(
        "group flex w-full items-center gap-3 rounded-lg border border-border/70 bg-card p-3 text-left transition-colors",
        canPreview ? "hover:border-primary/30 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" : "cursor-not-allowed opacity-60",
        className,
      )}
      aria-label={`Preview ${attachment.name}`}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-muted/40">
        <AttachmentIcon type={attachment.type} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{attachment.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{attachment.size}</span>
          <ScanIndicator status={attachment.scanStatus} />
        </div>
      </div>
      {canPreview && (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <Eye className="h-4 w-4" aria-hidden />
        </span>
      )}
    </button>
  );
}

export function AttachmentPreviewGrid({
  attachments,
  onPreview,
  className,
}: {
  attachments: Attachment[];
  onPreview?: (a: Attachment) => void;
  className?: string;
}) {
  if (!attachments.length) {
    return <p className="text-sm text-muted-foreground">No attachments.</p>;
  }
  return (
    <ul className={cn("grid grid-cols-1 gap-2 sm:grid-cols-2", className)}>
      {attachments.map((a) => (
        <li key={a.id}>
          <AttachmentPreviewTile attachment={a} onPreview={onPreview} />
        </li>
      ))}
    </ul>
  );
}
