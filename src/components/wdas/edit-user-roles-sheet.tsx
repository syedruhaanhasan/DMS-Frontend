import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import type { User } from "@/lib/wdas/types";
import { wdasConfig } from "@/services/wdas-config";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface EditUserRolesSheetProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function EditUserRolesSheet({ user, open, onOpenChange, onSaved }: EditUserRolesSheetProps) {
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const rolesQ = useQuery({
    queryKey: ["security-roles"],
    queryFn: () => wdasConfig.listRoles(),
    enabled: open,
  });

  useEffect(() => {
    if (user) {
      setRoleIds(user.roleIds?.length ? user.roleIds : []);
    }
  }, [user]);

  if (!user) return null;

  const initial = user.roleIds ?? [];
  const changed =
    roleIds.length !== initial.length || roleIds.some((id) => !initial.includes(id));

  const save = async () => {
    if (!roleIds.length) {
      toast.error("Select at least one role.");
      return;
    }
    setSaving(true);
    try {
      await wdasConfig.updateUserRoles(user.id, roleIds);
      toast.success("User roles updated", { description: `${user.name}` });
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message || "Could not update roles.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Edit roles — {user.name}</SheetTitle>
          <SheetDescription>{user.email} · {user.department}</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Roles</Label>
            <div className="flex flex-wrap gap-3">
              {(rolesQ.data ?? []).map((r) => (
                <label key={r.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={roleIds.includes(r.id)}
                    disabled={saving}
                    onCheckedChange={(checked) => {
                      setRoleIds((prev) => {
                        if (checked) return prev.includes(r.id) ? prev : [...prev, r.id];
                        const next = prev.filter((id) => id !== r.id);
                        return next.length ? next : prev;
                      });
                    }}
                  />
                  {r.name}
                </label>
              ))}
            </div>
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving || !changed}>
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</> : "Save roles"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
