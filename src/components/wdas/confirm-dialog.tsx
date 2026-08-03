import { useState, type ReactNode } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive" | "success" | "warning";
  requireReason?: boolean;
  reasonLabel?: string;
  onConfirm: (reason?: string) => void | Promise<void>;
  extraContent?: ReactNode;
}

export function ConfirmDialog({
  open, onOpenChange, title, description,
  confirmLabel = "Confirm", cancelLabel = "Cancel",
  variant = "default", requireReason, reasonLabel = "Reason", onConfirm, extraContent,
}: Props) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const cls =
    variant === "destructive" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" :
    variant === "success" ? "bg-success text-success-foreground hover:bg-success/90" :
    variant === "warning" ? "bg-warning text-warning-foreground hover:bg-warning/90" :
    "bg-primary text-primary-foreground hover:bg-primary/90";

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!busy) { onOpenChange(o); if (!o) setReason(""); } }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription asChild><div>{description}</div></AlertDialogDescription>}
        </AlertDialogHeader>
        {extraContent}
        {requireReason && (
          <div className="space-y-2">
            <Label htmlFor="reason">{reasonLabel} <span className="text-destructive">*</span></Label>
            <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Provide a clear comment…" rows={3} />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy || (requireReason && !reason.trim())}
            className={cn(cls)}
            onClick={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await onConfirm(requireReason ? reason.trim() : undefined);
                onOpenChange(false);
                setReason("");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Working…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
