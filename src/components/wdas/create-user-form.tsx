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
  const adStatusQ = useQuery({
    queryKey: ["ad-status"],
    queryFn: () => wdasConfig.getActiveDirectoryStatus(),
  });
  const adEnabled = adStatusQ.data?.enabled ?? false;
  const [accountType, setAccountType] = useState<AccountType>("local");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [userTypeId, setUserTypeId] = useState("");
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const NO_USER_TYPE = "__none__";

  const isAdAccount = accountType === "ad";

  // If AD gets disabled while an AD account type is selected, fall back to local.
  useEffect(() => {
    if (!adEnabled && accountType === "ad") setAccountType("local");
  }, [adEnabled, accountType]);

  const departments = useQuery({
    queryKey: ["departments"],
    queryFn: () => wdasConfig.listDepartments(true),
  });

  const rolesQ = useQuery({
    queryKey: ["security-roles"],
    queryFn: () => wdasConfig.listRoles(),
  });

  const userTypesQ = useQuery({
    queryKey: ["user-types", "active"],
    queryFn: () => wdasConfig.listUserTypes(true),
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
    const maker = rolesQ.data?.find((r) => r.code === "MakerOwner") ?? rolesQ.data?.[0];
    setRoleIds(maker ? [maker.id] : []);
    setDepartmentId(departments.data?.[0]?.id ?? "");
    setUserTypeId("");
  };

  const submit = async () => {
    if (!username.trim() || !displayName.trim() || !email.trim() || !departmentId) {
      toast.error("Please fill all required fields.");
      return;
    }
    if (/\s/.test(username)) {
      toast.error("Username cannot contain spaces.");
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
        title: "Staff",
        departmentId,
        roleIds,
        accountType,
        userTypeId: userTypeId || null,
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
              {adEnabled && <SelectItem value="ad">Active Directory</SelectItem>}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Username *</Label>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value.replace(/\s+/g, ""))}
            placeholder="jsmith"
            autoComplete="username"
          />
          <p className="text-xs text-muted-foreground">No spaces allowed.</p>
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
        <div className="space-y-2">
          <Label>User type</Label>
          <Select
            value={userTypeId || NO_USER_TYPE}
            onValueChange={(v) => setUserTypeId(v === NO_USER_TYPE ? "" : v)}
          >
            <SelectTrigger><SelectValue placeholder="Select user type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_USER_TYPE}>None</SelectItem>
              {(userTypesQ.data ?? []).map((ut) => (
                <SelectItem key={ut.id} value={ut.id}>{ut.name}</SelectItem>
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
