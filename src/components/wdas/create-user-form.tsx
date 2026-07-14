import { useEffect, useMemo, useState } from "react";
import { isValidEmail } from "@/lib/validation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { wdasConfig } from "@/services/wdas-config";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

type AccountType = "local" | "ad";

interface CreateUserFormProps {
  onCreated?: () => void;
  onCancel?: () => void;
  showCancel?: boolean;
  submitLabel?: string;
}

export function CreateUserForm({
  onCreated,
  onCancel,
  showCancel = false,
  submitLabel = "Create user",
}: CreateUserFormProps) {
  const qc = useQueryClient();
  const [accountType, setAccountType] = useState<AccountType>("local");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const isAdAccount = accountType === "ad";

  const departments = useQuery({
    queryKey: ["departments"],
    queryFn: () => wdasConfig.listDepartments(true),
  });

  const rolesQ = useQuery({
    queryKey: ["security-roles"],
    queryFn: () => wdasConfig.listRoles(),
  });

  const emailError = useMemo(
    () => (email.length > 0 && !isValidEmail(email) ? "Invalid email format (e.g. name@company.com)" : ""),
    [email],
  );

  useEffect(() => {
    if (departments.data?.length) {
      setDepartmentId((cur) => cur || departments.data![0].id);
    }
  }, [departments.data]);

  useEffect(() => {
    if (!roleIds.length && rolesQ.data?.length) {
      const maker = rolesQ.data.find((r) => r.code === "MakerOwner") ?? rolesQ.data[0];
      if (maker) setRoleIds([maker.id]);
    }
  }, [rolesQ.data, roleIds.length]);

  const reset = () => {
    setAccountType("local");
    setUsername("");
    setPassword("");
    setDisplayName("");
    setEmail("");
    setTitle("");
    const maker = rolesQ.data?.find((r) => r.code === "MakerOwner") ?? rolesQ.data?.[0];
    setRoleIds(maker ? [maker.id] : []);
    setDepartmentId(departments.data?.[0]?.id ?? "");
  };

  const submit = async () => {
    if (!username.trim() || !displayName.trim() || !email.trim() || !departmentId) {
      toast.error("Please fill all required fields.");
      return;
    }
    if (!isAdAccount && !password) {
      toast.error("Password is required for normal users.");
      return;
    }
    if (!isValidEmail(email)) {
      toast.error("Please enter a valid email address (e.g. name@company.com).");
      return;
    }
    if (!isAdAccount && password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }

    if (!roleIds.length) {
      toast.error("Select at least one role.");
      return;
    }

    setSaving(true);
    try {
      const user = await wdasConfig.createUser({
        username: username.trim(),
        password: isAdAccount ? undefined : password,
        displayName: displayName.trim(),
        email: email.trim(),
        title: title.trim() || "Staff",
        departmentId,
        roleIds,
        accountType,
      });
      toast.success("User created successfully", {
        description: isAdAccount
          ? `${user.name} can sign in with Active Directory.`
          : `${user.name} can sign in with username "${username.trim()}".`,
      });
      reset();
      qc.invalidateQueries({ queryKey: ["directory"] });
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["user-management"] });
      onCreated?.();
    } catch (err) {
      toast.error((err as Error).message || "Could not create user.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Account type *</Label>
          <Select value={accountType} onValueChange={(v) => setAccountType(v as AccountType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="local">Local (username & password)</SelectItem>
              <SelectItem value="ad">Active Directory</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Username *</Label>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="jsmith" />
        </div>
        {!isAdAccount && (
          <div className="space-y-2">
            <Label>Password *</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        )}
        <div className="space-y-2">
          <Label>Display name *</Label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Email *</Label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} />
          {emailError && <p className="text-xs text-destructive">{emailError}</p>}
        </div>
        <div className="space-y-2">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Staff" />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Department *</Label>
          <Select value={departmentId} onValueChange={setDepartmentId}>
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

      <div className="flex justify-end gap-2">
        {showCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
        )}
        <Button type="button" onClick={submit} disabled={saving}>
          {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…</> : submitLabel}
        </Button>
      </div>
    </div>
  );
}
