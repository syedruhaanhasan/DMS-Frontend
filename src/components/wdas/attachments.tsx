import { FileText, Image as ImageIcon, FileSpreadsheet, FileType, Presentation, ShieldCheck, ShieldAlert, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Attachment } from "@/lib/wdas/types";

export function AttachmentIcon({ type }: { type: Attachment["type"] }) {
  const map = {
    pdf: <FileText className="h-5 w-5 text-destructive" />,
    word: <FileType className="h-5 w-5 text-info" />,
    excel: <FileSpreadsheet className="h-5 w-5 text-success" />,
    ppt: <Presentation className="h-5 w-5 text-warning" />,
    image: <ImageIcon className="h-5 w-5 text-muted-foreground" />,
  };
  return map[type];
}

function ScanBadge({ status }: { status?: Attachment["scanStatus"] }) {
  if (!status || status === "Clean") {
    return (
      <Badge variant="outline" className="text-[10px] text-success">
        <ShieldCheck className="mr-0.5 h-3 w-3" /> Scanned
      </Badge>
    );
  }
  if (status === "Pending") {
    return (
      <Badge variant="outline" className="text-[10px] text-warning">
        <Loader2 className="mr-0.5 h-3 w-3" /> Scanning
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] text-destructive">
      <ShieldAlert className="mr-0.5 h-3 w-3" /> Quarantined
    </Badge>
  );
}

export function AttachmentList({ attachments, onPreview }: { attachments: Attachment[]; onPreview?: (a: Attachment) => void }) {
  if (!attachments.length) return <p className="text-sm text-muted-foreground">No attachments.</p>;
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {attachments.map((a) => (
        <li key={a.id}>
          <button
            type="button"
            onClick={() => onPreview?.(a)}
            className="flex w-full items-center gap-3 rounded-md border bg-card p-3 text-left hover:bg-muted/60"
          >
            <AttachmentIcon type={a.type} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{a.name}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                <p className="text-xs text-muted-foreground">{a.size}</p>
                <ScanBadge status={a.scanStatus} />
              </div>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
