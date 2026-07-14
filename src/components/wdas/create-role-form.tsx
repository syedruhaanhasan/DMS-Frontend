import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { CONFIG_MODULES, PERMISSION_GROUPS } from "@/lib/wdas/permissions";
import { wdasConfig } from "@/services/wdas-config";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export type RoleFormValue = {
  id?: string;
  name: string;
  description?: string;
  permissions: string[];
  isActive?: boolean;
  isSystem?: boolean;
};

interface RoleFormProps {
  initial?: RoleFormValue | null;
  existingNames: string[];
  onSaved: () => void;
}

export function RoleForm({ initial, existingNames, onSaved }: RoleFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [permissions, setPermissions] = useState<string[]>(initial?.permissions ?? []);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const isEdit = !!initial?.id;
  const isSystem = !!initial?.isSystem;

  useEffect(() => {
    setName(initial?.name ?? "");
    setDescription(initial?.description ?? "");
    setPermissions(initial?.permissions ?? []);
    setIsActive(initial?.isActive ?? true);
  }, [initial]);

  const catalog = useMemo(() => PERMISSION_GROUPS, []);
  const configKeys = useMemo(
    () => CONFIG_MODULES.flatMap((m) => [m.make, m.check]),
    [],
  );

  const toggle = (key: string, checked: boolean) => {
    setPermissions((prev) => (checked ? [...prev, key] : prev.filter((x) => x !== key)));
  };

  const toggleGroup = (keys: string[], checked: boolean) => {
    setPermissions((prev) => {
      const set = new Set(prev);
      for (const k of keys) {
        if (checked) set.add(k);
        else set.delete(k);
      }
      return [...set];
    });
  };

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Role name is required.");
      return;
    }
    if (
      existingNames.some(
        (n) => n.toLowerCase() === trimmed.toLowerCase() && n.toLowerCase() !== (initial?.name ?? "").toLowerCase(),
      )
    ) {
      toast.error("A role with this name already exists.");
      return;
    }
    if (!permissions.length) {
      toast.error("Select at least one permission.");
      return;
    }

    setSaving(true);
    try {
      if (isEdit && initial?.id) {
        await wdasConfig.updateRole(initial.id, {
          name: isSystem ? initial.name : trimmed,
          description: description.trim() || null,
          isActive,
          permissions,
        });
        toast.success("Role updated");
      } else {
        await wdasConfig.createRole({
          name: trimmed,
          description: description.trim() || null,
          permissions,
        });
        toast.success("Role created");
      }
      onSaved();
    } catch (err) {
      toast.error((err as Error).message || "Could not save role.");
    } finally {
      setSaving(false);
    }
  };

  const allConfigChecked = configKeys.every((k) => permissions.includes(k));

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="role-name">Role name *</Label>
        <Input
          id="role-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isSystem}
          placeholder="e.g. Finance Reviewer"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="role-summary">Description</Label>
        <Textarea
          id="role-summary"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="What this role can access…"
        />
      </div>
      {isEdit && !isSystem && (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={isActive} onCheckedChange={(v) => setIsActive(v === true)} />
          Active
        </label>
      )}
      <div className="max-h-[360px] space-y-4 overflow-y-auto rounded-md border p-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Configuration</p>
              <p className="text-xs text-muted-foreground">
                Maker creates or edits; Checker activates, publishes, or deletes.
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox
                checked={allConfigChecked}
                onCheckedChange={(v) => toggleGroup(configKeys, v === true)}
              />
              All
            </label>
          </div>
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Screen</th>
                  <th className="w-24 px-3 py-2 text-center font-medium">Maker</th>
                  <th className="w-24 px-3 py-2 text-center font-medium">Checker</th>
                </tr>
              </thead>
              <tbody>
                {CONFIG_MODULES.map((m) => (
                  <tr key={m.base} className="border-b last:border-0">
                    <td className="px-3 py-2">{m.label}</td>
                    <td className="px-3 py-2 text-center">
                      <Checkbox
                        checked={permissions.includes(m.make)}
                        onCheckedChange={(v) => toggle(m.make, v === true)}
                        aria-label={`${m.label} Maker`}
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Checkbox
                        checked={permissions.includes(m.check)}
                        onCheckedChange={(v) => toggle(m.check, v === true)}
                        aria-label={`${m.label} Checker`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {catalog.map((group) => {
          const keys = group.items.map((i) => i.key);
          const allChecked = keys.every((k) => permissions.includes(k));
          return (
            <div key={group.group} className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{group.group}</p>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox
                    checked={allChecked}
                    onCheckedChange={(v) => toggleGroup(keys, v === true)}
                  />
                  All
                </label>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {group.items.map((item) => (
                  <label key={item.key} className="flex items-start gap-2 text-sm">
                    <Checkbox
                      checked={permissions.includes(item.key)}
                      onCheckedChange={(v) => toggle(item.key, v === true)}
                      className="mt-0.5"
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <Button type="button" onClick={submit} disabled={saving} className="w-full sm:w-auto">
        {saving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
          </>
        ) : isEdit ? (
          "Save role"
        ) : (
          "Create role"
        )}
      </Button>
    </div>
  );
}
