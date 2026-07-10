import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export type ActiveFilter = "all" | "active" | "inactive";

export function ActiveStatusBadge({ active, className }: { active: boolean; className?: string }) {
  return (
    <Badge
      variant={active ? "outline" : "secondary"}
      className={cn(active ? "border-success/30 text-success" : "text-muted-foreground", className)}
    >
      {active ? "Active" : "Inactive"}
    </Badge>
  );
}

export function ActiveStatusFilter({
  value,
  onChange,
  label = "Status",
  className,
}: {
  value: ActiveFilter;
  onChange: (value: ActiveFilter) => void;
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Label className="text-xs text-muted-foreground whitespace-nowrap">{label}</Label>
      <Select value={value} onValueChange={(v) => onChange(v as ActiveFilter)}>
        <SelectTrigger className="h-9 w-[130px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export function ActiveStatusSwitch({
  active,
  onChange,
  disabled,
  label = "Active",
  id,
}: {
  active: boolean;
  onChange: (active: boolean) => void | Promise<void>;
  disabled?: boolean;
  label?: string;
  id?: string;
}) {
  const switchId = id ?? "active-status-switch";
  return (
    <div className="flex items-center gap-2">
      <Switch id={switchId} checked={active} onCheckedChange={(v) => void onChange(v)} disabled={disabled} />
      {label ? <Label htmlFor={switchId} className="text-sm font-normal">{label}</Label> : null}
    </div>
  );
}

export function matchesActiveFilter(active: boolean, filter: ActiveFilter): boolean {
  if (filter === "all") return true;
  if (filter === "active") return active;
  return !active;
}

export function activeFilterToQuery(filter: ActiveFilter): boolean | undefined {
  if (filter === "active") return true;
  if (filter === "inactive") return false;
  return undefined;
}
