import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { wdasConfig } from "@/services/wdas-config";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface CreateDepartmentFormProps {
  onCreated?: () => void;
}

export function CreateDepartmentForm({ onCreated }: CreateDepartmentFormProps) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [parentId, setParentId] = useState<string>("none");
  const [saving, setSaving] = useState(false);

  const departments = useQuery({
    queryKey: ["departments"],
    queryFn: () => wdasConfig.listDepartments(),
  });

  const reset = () => {
    setName("");
    setCode("");
    setParentId("none");
  };

  const submit = async () => {
    if (!name.trim() || !code.trim()) {
      toast.error("Department name and prefix are required.");
      return;
    }
    if (code.trim().length < 2) {
      toast.error("Department prefix must be at least 2 characters.");
      return;
    }

    setSaving(true);
    try {
      const dept = await wdasConfig.createDepartment({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        parentDepartmentId: parentId === "none" ? null : parentId,
      });
      toast.success("Department created", { description: `${dept.name} (${dept.code}) is now available.` });
      reset();
      qc.invalidateQueries({ queryKey: ["departments"] });
      onCreated?.();
    } catch (err) {
      toast.error((err as Error).message || "Could not create department.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="dept-name">Department name *</Label>
          <Input
            id="dept-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Human Resources"
            disabled={saving}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dept-code">Prefix *</Label>
          <Input
            id="dept-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="HR"
            maxLength={20}
            disabled={saving}
          />
          <p className="text-xs text-muted-foreground">Short unique prefix (e.g. HR, OPS, LEG)</p>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Parent department (optional)</Label>
          <Select value={parentId} onValueChange={setParentId} disabled={saving || departments.isLoading}>
            <SelectTrigger className="sm:max-w-md"><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None (top-level)</SelectItem>
              {(departments.data ?? []).map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name} ({d.code})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button type="button" onClick={submit} disabled={saving}>
        {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…</> : "Create department"}
      </Button>
    </div>
  );
}
