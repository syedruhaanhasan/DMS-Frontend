import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/wdas/role-context";
import { isAdminRole } from "@/lib/wdas/role-context";
import { useUsers } from "@/lib/wdas/users-context";
import { wdasConfig } from "@/services/wdas-config";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { UserCog } from "lucide-react";
import type { Document } from "@/lib/wdas/types";

/** Admin-only Force Reassign action for a stuck document. */
export function ForceReassignButton({ doc }: { doc: Document }) {
  const { role, user } = useSession();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [approverId, setApproverId] = useState<string>("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  if (!isAdminRole(role)) return null;
  if (doc.status !== "pending") return null;

  const { users } = useUsers();
  const eligible = users.filter((u) => u.status !== "disabled");

  const submit = async () => {
    if (!approverId || !reason.trim()) return;
    setBusy(true);
    try {
      await wdasConfig.forceReassign(doc.id, approverId, reason.trim(), user.id);
      qc.invalidateQueries();
      toast.success("Step reassigned", { description: `Document reassigned with reason on record.` });
      setOpen(false);
      setReason(""); setApproverId("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        title="Force reassign (Admin)"
        onClick={() => setOpen(true)}
        className="text-warning hover:text-warning"
      >
        <UserCog className="h-3.5 w-3.5" />
      </Button>

      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Force reassign approval step</DialogTitle>
            <DialogDescription>
              Reassign <span className="font-medium text-foreground">{doc.subject}</span> to another eligible approver.
              This action is logged in the document trail with your reason.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>New approver</Label>
              <Select value={approverId} onValueChange={setApproverId}>
                <SelectTrigger><SelectValue placeholder="Choose an approver" /></SelectTrigger>
                <SelectContent>
                  {eligible.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name} — {u.designation} · {u.department}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Reason <span className="text-destructive">*</span></Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Explain why this step must be reassigned…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={submit} disabled={busy || !approverId || !reason.trim()}>
              {busy ? "Reassigning…" : "Reassign step"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
