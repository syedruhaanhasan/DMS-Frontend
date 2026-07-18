import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { User } from "@/lib/wdas/types";
import { isValidEmail } from "@/lib/validation";
import { wdasConfig } from "@/services/wdas-config";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface EditUserSheetProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function EditUserSheet({ user, open, onOpenChange, onSaved }: EditUserSheetProps) {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const departments = useQuery({
    queryKey: ["departments"],
    queryFn: () => wdasConfig.listDepartments(true),
    enabled: open,
  });

  const rolesQ = useQuery({
    queryKey: ["security-roles"],
    queryFn: () => wdasConfig.listRoles(),
    enabled: open,
  });

  useEffect(() => {
    if (!user) return;
    setUsername(user.username ?? "");
    setDisplayName(user.name ?? "");
    setEmail(user.email ?? "");
    setPhone(user.phone ?? "");
    setTitle(user.designation ?? "");
    setDepartmentId(user.departmentId ?? "");
    setRoleIds(user.roleIds?.length ? [...user.roleIds] : []);
    setIsActive(user.isActive !== false);
  }, [user]);

  const emailError = useMemo(
    () => (email.length > 0 && !isValidEmail(email) ? "Invalid email format (e.g. name@company.com)" : ""),
    [email],
  );

  if (!user) return null;

  const save = async () => {
    if (!username.trim() || !displayName.trim() || !email.trim() || !departmentId) {
      toast.error("Please fill all required fields.");
      return;
    }
    if (!isValidEmail(email)) {
      toast.error("Please enter a valid email address (e.g. name@company.com).");
      return;
    }
    if (!roleIds.length) {
      toast.error("Select at least one role.");
      return;
    }

    setSaving(true);
    try {
      await wdasConfig.updateUser(user.id, {
        username: username.trim(),
        displayName: displayName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        title: title.trim() || "Staff",
        departmentId,
        roleIds,
        isActive,
      });
      toast.success("User updated", { description: displayName.trim() });
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message || "Could not update user.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Edit user — {user.name}</SheetTitle>
          <SheetDescription>
            Update profile, department, roles, and status. Password cannot be changed here.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Username *</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} disabled={saving} />
            </div>
            <div className="space-y-2">
              <Label>Display name *</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} disabled={saving} />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} disabled={saving} />
              {emailError && <p className="text-xs text-destructive">{emailError}</p>}
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" disabled={saving} />
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Staff" disabled={saving} />
            </div>
            <div className="space-y-2">
              <Label>Department *</Label>
              <Select value={departmentId} onValueChange={setDepartmentId} disabled={saving}>
                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  {(departments.data ?? []).map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Roles *</Label>
            <div className="flex flex-wrap gap-3 rounded-md border p-3">
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
              {rolesQ.isLoading && <span className="text-sm text-muted-foreground">Loading roles…</span>}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <div>
              <Label htmlFor="edit-user-active">Active</Label>
              <p className="text-xs text-muted-foreground">Inactive users cannot sign in.</p>
            </div>
            <Switch id="edit-user-active" checked={isActive} onCheckedChange={setIsActive} disabled={saving} />
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</> : "Save changes"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
