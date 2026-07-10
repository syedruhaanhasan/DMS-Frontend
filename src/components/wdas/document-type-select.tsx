import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { wdasConfig } from "@/services/wdas-config";
import { Loader2 } from "lucide-react";
import type { DocumentTypeCatalogItem } from "@/lib/wdas/types";

export interface DocumentTypeSelection {
  code: string;
  name: string;
  category: "financial" | "non_financial";
}

interface DocumentTypeSelectProps {
  value?: string;
  onChange: (selection: DocumentTypeSelection) => void;
  disabled?: boolean;
  required?: boolean;
  label?: string;
}

export function DocumentTypeSelect({
  value,
  onChange,
  disabled,
  required,
  label = "Document type",
}: DocumentTypeSelectProps) {
  const q = useQuery({
    queryKey: ["document-types"],
    queryFn: () => wdasConfig.listDocumentTypes(),
  });

  const types = (q.data ?? []).filter((t) => t.isActive);
  const selected = types.find((t) => t.code === value);
  const legacy = value && !selected ? value : undefined;

  const pick = (code: string) => {
    const item = types.find((t) => t.code === code);
    if (!item) return;
    onChange({ code: item.code, name: item.name, category: item.category });
  };

  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {q.isLoading ? (
        <div className="flex h-9 items-center gap-2 rounded-md border bg-muted/30 px-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading document types…
        </div>
      ) : (
        <Select
          value={value || undefined}
          onValueChange={pick}
          disabled={disabled || !types.length}
        >
          <SelectTrigger>
            <SelectValue placeholder={types.length ? "Select document type" : "No document types yet"} />
          </SelectTrigger>
          <SelectContent>
            {legacy && (
              <SelectItem value={legacy}>
                {legacy} <span className="text-muted-foreground">(current)</span>
              </SelectItem>
            )}
            {types.map((t) => (
              <SelectItem key={t.id} value={t.code}>
                <DocumentTypeOptionLabel item={t} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {!q.isLoading && !types.length && (
        <p className="text-xs text-muted-foreground">
          <Link to="/config/document-types" className="text-primary hover:underline">
            Create a document type
          </Link>{" "}
          first, then return here.
        </p>
      )}
      {selected && (
        <p className="text-xs text-muted-foreground">
          Code: <span className="font-mono">{selected.code}</span>
          {" · "}
          {selected.category === "financial" ? "Financial" : "Non-financial"}
        </p>
      )}
    </div>
  );
}

function DocumentTypeOptionLabel({ item }: { item: DocumentTypeCatalogItem }) {
  return (
    <span className="flex items-center gap-2">
      <span>{item.name}</span>
      <span className="font-mono text-xs text-muted-foreground">{item.code}</span>
    </span>
  );
}

export function documentTypeLabel(types: DocumentTypeCatalogItem[] | undefined, code?: string) {
  if (!code) return "—";
  return types?.find((t) => t.code === code)?.name ?? code;
}
