import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { APP_ROLES, type AppRole, type User } from "@/lib/wdas/types";
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
  const [roles, setRoles] = useState<AppRole[]>(["Maker"]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setRoles(user.appRoles?.length ? user.appRoles : [user.appRole ?? "Maker"]);
    }
  }, [user]);

  if (!user) return null;

  const initial = user.appRoles?.length ? user.appRoles : [user.appRole ?? "Maker"];
  const changed = roles.length !== initial.length || roles.some((r) => !initial.includes(r));

  const save = async () => {
    if (!roles.length) {
      toast.error("Select at least one role.");
      return;
    }
    setSaving(true);
    try {
      await wdasConfig.updateUserRoles(user.id, roles);
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
            <Label>Application roles</Label>
            <div className="flex flex-wrap gap-3">
              {APP_ROLES.map((r) => (
                <label key={r} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={roles.includes(r)}
                    disabled={saving}
                    onCheckedChange={(checked) => {
                      setRoles((prev) => {
                        if (checked) return prev.includes(r) ? prev : [...prev, r];
                        const next = prev.filter((role) => role !== r);
                        return next.length ? next : prev;
                      });
                    }}
                  />
                  {r}
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
