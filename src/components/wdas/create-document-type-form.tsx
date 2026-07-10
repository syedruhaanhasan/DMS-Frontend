import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { wdasConfig } from "@/services/wdas-config";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface CreateDocumentTypeFormProps {
  onCreated?: () => void;
}

function slugCode(name: string) {
  return name.trim().replace(/\s+/g, "");
}

export function CreateDocumentTypeForm({ onCreated }: CreateDocumentTypeFormProps) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<"financial" | "non_financial">("non_financial");
  const [amountRequired, setAmountRequired] = useState(false);
  const [codeTouched, setCodeTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName("");
    setCode("");
    setDescription("");
    setCategory("non_financial");
    setAmountRequired(false);
    setCodeTouched(false);
  };

  const submit = async () => {
    const trimmedName = name.trim();
    const trimmedCode = (codeTouched ? code : slugCode(name)).trim();

    if (!trimmedName) {
      toast.error("Document type name is required.");
      return;
    }
    if (trimmedCode.length < 2) {
      toast.error("Code must be at least 2 characters.");
      return;
    }

    setSaving(true);
    try {
      const created = await wdasConfig.createDocumentType({
        name: trimmedName,
        code: trimmedCode,
        description: description.trim() || undefined,
        category,
        amountRequired: category === "financial" ? amountRequired : false,
      });
      toast.success("Document type created", { description: `${created.name} (${created.code}) is now available.` });
      reset();
      qc.invalidateQueries({ queryKey: ["document-types"] });
      onCreated?.();
    } catch (err) {
      toast.error((err as Error).message || "Could not create document type.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="doc-type-name">Name *</Label>
          <Input
            id="doc-type-name"
            value={name}
            onChange={(e) => {
              const next = e.target.value;
              setName(next);
              if (!codeTouched) setCode(slugCode(next));
            }}
            placeholder="Purchase Request"
            disabled={saving}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="doc-type-code">Code *</Label>
          <Input
            id="doc-type-code"
            value={code}
            onChange={(e) => {
              setCodeTouched(true);
              setCode(e.target.value.replace(/\s/g, ""));
            }}
            placeholder="PurchaseRequest"
            disabled={saving}
          />
          <p className="text-xs text-muted-foreground">Unique identifier used in workflows (no spaces)</p>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="doc-type-desc">Description</Label>
          <Input
            id="doc-type-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional short description"
            disabled={saving}
          />
        </div>
        <div className="space-y-2">
          <Label>Category</Label>
          <Select
            value={category}
            onValueChange={(v) => {
              const next = v as "financial" | "non_financial";
              setCategory(next);
              setAmountRequired(next === "financial");
            }}
            disabled={saving}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="financial">Financial</SelectItem>
              <SelectItem value="non_financial">Non-financial</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {category === "financial" && (
          <div className="flex items-center gap-2 sm:col-span-2">
            <Checkbox
              id="doc-type-amount-required"
              checked={amountRequired}
              onCheckedChange={(checked) => setAmountRequired(checked === true)}
              disabled={saving}
            />
            <Label htmlFor="doc-type-amount-required" className="cursor-pointer font-normal">
              Amount is mandatory for this document type
            </Label>
          </div>
        )}
      </div>
      <Button type="button" onClick={submit} disabled={saving}>
        {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…</> : "Create document type"}
      </Button>
    </div>
  );
}
