import { useEffect, useMemo, useState } from "react";
import { isValidEmail } from "@/lib/validation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { wdasConfig } from "@/services/wdas-config";
import { APP_ROLES, type AppRole } from "@/lib/wdas/types";
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
  const [appRoles, setAppRoles] = useState<AppRole[]>(["Maker"]);
  const [saving, setSaving] = useState(false);

  const isAdAccount = accountType === "ad";

  const departments = useQuery({
    queryKey: ["departments"],
    queryFn: () => wdasConfig.listDepartments(),
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

  const reset = () => {
    setAccountType("local");
    setUsername("");
    setPassword("");
    setDisplayName("");
    setEmail("");
    setTitle("");
    setAppRoles(["Maker"]);
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

    if (!appRoles.length) {
      toast.error("Select at least one application role.");
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
        roles: appRoles,
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
      <div className="space-y-2">
        <Label>Account type *</Label>
        <Select
          value={accountType}
          onValueChange={(v) => setAccountType(v as AccountType)}
          disabled={saving}
        >
          <SelectTrigger className="sm:max-w-md"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="local">Normal user</SelectItem>
            <SelectItem value="ad">Active Directory</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {isAdAccount
            ? "User signs in with their Active Directory credentials. No local password is stored."
            : "User signs in with the username and password you set below."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className={`space-y-2 ${isAdAccount ? "sm:col-span-2" : ""}`}>
          <Label htmlFor="cu-username">Username *</Label>
          <Input id="cu-username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="jane.doe" autoComplete="off" disabled={saving} />
        </div>
        {!isAdAccount && (
          <div className="space-y-2">
            <Label htmlFor="cu-password">Password *</Label>
            <Input id="cu-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 8 characters" autoComplete="new-password" disabled={saving} />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="cu-name">Display name *</Label>
          <Input id="cu-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Jane Doe" disabled={saving} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cu-email">Email *</Label>
          <Input
            id="cu-email"
            type="email"
            value={email}
            maxLength={255}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@company.com"
            disabled={saving}
            aria-invalid={!!emailError}
          />
          {emailError && <p className="text-xs text-destructive">{emailError}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="cu-title">Job title</Label>
          <Input id="cu-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Analyst" disabled={saving} />
        </div>
        <div className="space-y-2">
          <Label>Department *</Label>
          <Select value={departmentId} onValueChange={setDepartmentId} disabled={saving || departments.isLoading}>
            <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
            <SelectContent>
              {(departments.data ?? []).map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Application roles *</Label>
          <div className="flex flex-wrap gap-3">
            {APP_ROLES.map((r) => (
              <label key={r} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={appRoles.includes(r)}
                  disabled={saving}
                  onCheckedChange={(checked) => {
                    setAppRoles((prev) => {
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
          <p className="text-xs text-muted-foreground">A user can have more than one role.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {showCancel && onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
        )}
        <Button type="button" onClick={submit} disabled={saving || !!emailError}>
          {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…</> : submitLabel}
        </Button>
      </div>
    </div>
  );
}
