import { useMemo, useState } from "react";
import type { ApprovalMode, ApproverGroup, MatrixBand, User, Workflow } from "@/lib/wdas/types";
import { useUsers } from "@/lib/wdas/users-context";
import { formatPKR } from "@/lib/wdas/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, Plus, Trash2, ArrowUp, ArrowDown, GripVertical, AlertTriangle, ChevronUp, ChevronDown, X } from "lucide-react";
import { ChainPreview } from "./stepper";
import { cn } from "@/lib/utils";

function normalizeMode(mode?: ApprovalMode | "group"): ApprovalMode {
  if (mode === "group") return "user";
  return mode ?? "user";
}

/** Resolve the visible chain preview based on mode + config + sample amount. */
export function resolveWorkflowChain(
  mode: ApprovalMode | "group" | undefined,
  cfg: { bands?: MatrixBand[]; groups?: ApproverGroup[]; approverUserIds?: string[]; hybridFinalOwnerChoice?: boolean },
  sampleAmount: number,
  users: User[] = [],
): { label: string; sub?: string }[] {
  const userName = (id: string) => users.find((u) => u.id === id)?.name;
  const groupsById = new Map<string, ApproverGroup>((cfg.groups ?? []).map((g) => [g.id, g]));
  const nodes: { label: string; sub?: string }[] = [];
  const resolvedMode = normalizeMode(mode);

  if (resolvedMode === "matrix") {
    const band = (cfg.bands ?? []).find(
      (b) => sampleAmount >= b.min && (b.max === null || sampleAmount <= b.max),
    );
    if (!band) return nodes;
    band.approverGroupIds.forEach((gid) => {
      const g = groupsById.get(gid);
      if (!g) return;
      const members = g.memberIds.map((id) => userName(id)).filter(Boolean).join(", ");
      nodes.push({ label: g.name, sub: members || "no users" });
    });
  } else if (resolvedMode === "user") {
    (cfg.approverUserIds ?? []).forEach((id, index) => {
      nodes.push({ label: userName(id) ?? id, sub: `Step ${index + 1}` });
    });
  } else if (resolvedMode === "adhoc") {
    nodes.push({ label: "Document creator selects users", sub: "Chosen when submitting each document" });
  } else if (resolvedMode === "hybrid") {
    (cfg.approverUserIds ?? []).forEach((id, index) => {
      nodes.push({ label: userName(id) ?? id, sub: `Fixed step ${index + 1}` });
    });
    if (cfg.hybridFinalOwnerChoice) {
      nodes.push({ label: "Additional approver", sub: "Chosen by document creator" });
    }
  }
  return nodes;
}

/** Validate matrix bands: no gaps, no overlaps. */
export function validateMatrix(bands: MatrixBand[]): string[] {
  const errors: string[] = [];
  const sorted = [...bands].sort((a, b) => a.min - b.min);
  for (let i = 0; i < sorted.length; i++) {
    const b = sorted[i];
    if (b.max !== null && b.max < b.min) errors.push(`Band ${i + 1}: max is less than min.`);
    if (b.approverGroupIds.length === 0) errors.push(`Band ${i + 1}: pick at least one approver step.`);
    const next = sorted[i + 1];
    if (next) {
      if (b.max === null) errors.push(`Band ${i + 1}: "and above" band must be last.`);
      else if (next.min <= b.max) errors.push(`Bands ${i + 1} and ${i + 2} overlap.`);
      else if (next.min !== b.max + 1) errors.push(`Gap between band ${i + 1} and ${i + 2} (${formatPKR(b.max + 1)}–${formatPKR(next.min - 1)}).`);
    }
  }
  return errors;
}

interface Props {
  value: Partial<Workflow>;
  /** Pass a partial patch; parent should merge with `setState(prev => ({ ...prev, ...patch }))`. */
  onChange: (patch: Partial<Workflow>) => void;
  showPreview?: boolean;
}

export function ApprovalModeBuilder({ value, onChange, showPreview = true }: Props) {
  const { users } = useUsers();
  const mode = normalizeMode(value.mode);
  const bands = value.matrixBands ?? [];
  const groups = value.groups ?? [];
  const approverUserIds = value.approverUserIds ?? [];
  const [sample, setSample] = useState(120000);
  const isParallel = value.approvalSequence === "parallel";

  const errors = useMemo(() => (mode === "matrix" ? validateMatrix(bands) : []), [mode, bands]);
  const preview = useMemo(
    () => resolveWorkflowChain(mode, { bands, groups, approverUserIds, hybridFinalOwnerChoice: value.hybridFinalOwnerChoice }, sample, users),
    [mode, bands, groups, approverUserIds, value.hybridFinalOwnerChoice, sample, users],
  );

  const setMode = (m: ApprovalMode) => onChange({ mode: m });

  return (
    <div className="space-y-4">
      {showPreview && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm">Live chain preview</CardTitle>
            {mode === "matrix" && (
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Sample amount</Label>
                <Input
                  type="number"
                  value={sample}
                  onChange={(e) => setSample(Number(e.target.value) || 0)}
                  className="h-8 w-32 text-right"
                />
              </div>
            )}
          </CardHeader>
          <CardContent><ChainPreview nodes={preview} /></CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(["matrix", "user", "adhoc", "hybrid"] as ApprovalMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              "rounded-md border p-3 text-left text-sm transition-colors",
              mode === m ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-primary/40 hover:bg-muted/40",
            )}
          >
            <p className="font-semibold capitalize">{m === "adhoc" ? "Ad-hoc" : m}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {m === "matrix" && "Amount bands → users"}
              {m === "user" && "Select users in approval order"}
              {m === "adhoc" && "Creator picks users per document"}
              {m === "hybrid" && "Fixed users + creator choice"}
            </p>
          </button>
        ))}
      </div>

      {mode === "matrix" && (
        <>
          <MatrixEditor
            bands={bands}
            groups={groups}
            onChange={(next) => onChange({ matrixBands: next })}
            errors={errors}
          />
          <GroupsEditor groups={groups} onChange={(next) => onChange({ groups: next })} label="Approver steps (for matrix bands)" />
        </>
      )}
      {mode === "user" && (
        <UsersEditor
          userIds={approverUserIds}
          onChange={(next) => onChange({ approverUserIds: next })}
          isParallel={isParallel}
        />
      )}
      {(mode === "hybrid") && (
        <>
          <UsersEditor
            userIds={approverUserIds}
            onChange={(next) => onChange({ approverUserIds: next })}
            isParallel={isParallel}
            title="Fixed approvers"
          />
          <div className="flex items-center gap-3 rounded-md border bg-muted/30 p-3">
            <Switch
              id="hyb"
              checked={!!value.hybridFinalOwnerChoice}
              onCheckedChange={(v) => onChange({ hybridFinalOwnerChoice: v })}
            />
            <Label htmlFor="hyb" className="cursor-pointer">
              After the fixed users above, the document creator can add another approver at submission time.
            </Label>
          </div>
        </>
      )}
      {mode === "adhoc" && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>User-based approval</AlertTitle>
          <AlertDescription>
            Approvers are selected by the document creator when submitting. Use the Approval routing setting (Sequential / Parallel) to control how they act.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

/* ---------------- Matrix editor ---------------- */

function MatrixEditor({
  bands, groups, onChange, errors,
}: {
  bands: MatrixBand[];
  groups: ApproverGroup[];
  onChange: (b: MatrixBand[]) => void;
  errors: string[];
}) {
  const add = () => {
    const lastMax = bands.reduce((max, b) => (b.max !== null && b.max > max ? b.max : max), 0);
    onChange([
      ...bands,
      { id: `b-${Date.now()}`, min: lastMax + 1, max: lastMax + 100000, approverGroupIds: [], sequence: "sequential" },
    ]);
  };
  const update = (id: string, patch: Partial<MatrixBand>) => onChange(bands.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const remove = (id: string) => onChange(bands.filter((b) => b.id !== id));
  const move = (id: string, dir: -1 | 1) => {
    const idx = bands.findIndex((b) => b.id === id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= bands.length) return;
    const copy = [...bands];
    [copy[idx], copy[j]] = [copy[j], copy[idx]];
    onChange(copy);
  };

  return (
    <div className="space-y-3">
      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Fix these before publishing</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 list-disc pl-5 text-xs">
              {errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      <div className="rounded-md border">
        <div className="grid grid-cols-[24px_1fr_1fr_2fr_120px_80px] items-center gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
          <span></span><span>Min (PKR)</span><span>Max (PKR)</span><span>Approver step(s)</span><span>Sequence</span><span className="text-right">Actions</span>
        </div>
        {bands.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">No bands yet. Add your first band.</div>
        )}
        {bands.map((b, i) => (
          <div key={b.id} className="grid grid-cols-[24px_1fr_1fr_2fr_120px_80px] items-center gap-2 border-b px-3 py-2 last:border-0">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
            <Input type="number" value={b.min} onChange={(e) => update(b.id, { min: Number(e.target.value) || 0 })} className="h-8" />
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={b.max ?? ""}
                onChange={(e) => update(b.id, { max: e.target.value === "" ? null : Number(e.target.value) })}
                placeholder="and above"
                className="h-8"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {groups.map((g) => {
                const on = b.approverGroupIds.includes(g.id);
                return (
                  <button
                    type="button"
                    key={g.id}
                    onClick={() =>
                      update(b.id, {
                        approverGroupIds: on ? b.approverGroupIds.filter((x) => x !== g.id) : [...b.approverGroupIds, g.id],
                      })
                    }
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[11px]",
                      on ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted",
                    )}
                  >{g.name}</button>
                );
              })}
              {!groups.length && <span className="text-xs text-muted-foreground">Add approver steps below first.</span>}
            </div>
            <Select value={b.sequence} onValueChange={(v) => update(b.id, { sequence: v as "sequential" | "parallel" })}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sequential">Sequential</SelectItem>
                <SelectItem value="parallel">Parallel</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-0.5">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(b.id, -1)} disabled={i === 0}><ArrowUp className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(b.id, 1)} disabled={i === bands.length - 1}><ArrowDown className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(b.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" onClick={add}><Plus className="mr-1 h-3.5 w-3.5" /> Add band</Button>

      {groups.length === 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>Define approver steps below to assign users to amount bands.</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

/* ---------------- Users editor (replaces group mode) ---------------- */

function UsersEditor({
  userIds,
  onChange,
  isParallel,
  title = "Approvers",
}: {
  userIds: string[];
  onChange: (ids: string[]) => void;
  isParallel?: boolean;
  title?: string;
}) {
  const { users } = useUsers();
  const [query, setQuery] = useState("");

  const move = (id: string, direction: -1 | 1) => {
    const index = userIds.indexOf(id);
    if (index < 0) return;
    const target = index + direction;
    if (target < 0 || target >= userIds.length) return;
    const next = [...userIds];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const filtered = users.filter(
    (u) => !userIds.includes(u.id) &&
      (query ? u.name.toLowerCase().includes(query.toLowerCase()) || u.department.toLowerCase().includes(query.toLowerCase()) : true),
  ).slice(0, 8);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">
          {isParallel
            ? "Select users — all will receive documents at the same time."
            : "Select users in approval order — first selected approves first."}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1 rounded-md border p-2 min-h-[42px]">
          {userIds.map((id, index) => {
            const u = users.find((x) => x.id === id);
            return (
              <div key={id} className="flex items-center gap-0.5">
                <Badge variant="secondary" className="gap-1">
                  {!isParallel && <span className="text-[10px] font-semibold text-muted-foreground">{index + 1}.</span>}
                  {u?.name ?? id}
                  <button type="button" onClick={() => onChange(userIds.filter((x) => x !== id))} aria-label="Remove"><X className="h-3 w-3" /></button>
                </Badge>
                {!isParallel && (
                  <div className="flex flex-col">
                    <button type="button" className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30" disabled={index === 0} onClick={() => move(id, -1)} aria-label="Move up"><ChevronUp className="h-3 w-3" /></button>
                    <button type="button" className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30" disabled={index === userIds.length - 1} onClick={() => move(id, 1)} aria-label="Move down"><ChevronDown className="h-3 w-3" /></button>
                  </div>
                )}
              </div>
            );
          })}
          <input
            className="min-w-[120px] flex-1 border-0 bg-transparent p-1 text-sm outline-none"
            placeholder={userIds.length ? "Add another user…" : "Search users…"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {query && filtered.length > 0 && (
          <div className="rounded-md border bg-popover shadow">
            {filtered.map((u) => (
              <button
                key={u.id}
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => { onChange([...userIds, u.id]); setQuery(""); }}
              >
                <span>{u.name} <span className="text-muted-foreground">— {u.designation}</span></span>
                <span className="text-xs text-muted-foreground">{u.department}</span>
              </button>
            ))}
          </div>
        )}
        {userIds.length === 0 && (
          <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
            No users selected yet. Search and add approvers above.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------------- Legacy step editor (matrix / hybrid bands) ---------------- */

function GroupsEditor({
  groups, onChange, readOnly, label = "Approver steps",
}: {
  groups: ApproverGroup[];
  onChange: (g: ApproverGroup[]) => void;
  readOnly?: boolean;
  label?: string;
}) {
  const { users } = useUsers();
  const add = () => {
    onChange([...groups, { id: `g-${Date.now()}`, name: `Step ${groups.length + 1}`, memberIds: [], rule: "any" }]);
  };
  const update = (id: string, patch: Partial<ApproverGroup>) => onChange(groups.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  const remove = (id: string) => onChange(groups.filter((g) => g.id !== id));
  const move = (id: string, dir: -1 | 1) => {
    const idx = groups.findIndex((g) => g.id === id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= groups.length) return;
    const copy = [...groups];
    [copy[idx], copy[j]] = [copy[j], copy[idx]];
    onChange(copy);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{readOnly ? `${label} (read-only)` : label}</CardTitle>
        <p className="text-xs text-muted-foreground">Each step is one or more users for amount-based routing.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {groups.length === 0 && (
          <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
            {readOnly ? "No steps yet." : "No steps yet. Add your first approver step."}
          </p>
        )}
        {groups.map((g, i) => (
          <div key={g.id} className="rounded-md border p-3">
            <div className="mb-2 flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              <Input
                key={g.id}
                value={g.name}
                onChange={(e) => update(g.id, { name: e.target.value })}
                disabled={readOnly}
                className="h-8 max-w-xs font-medium"
              />
              <div className="flex-1" />
              {!readOnly && (
                <div className="flex gap-0.5">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(g.id, -1)} disabled={i === 0}><ArrowUp className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(g.id, 1)} disabled={i === groups.length - 1}><ArrowDown className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(g.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {users.map((u) => {
                const on = g.memberIds.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    disabled={readOnly}
                    onClick={() =>
                      update(g.id, {
                        memberIds: on ? g.memberIds.filter((x) => x !== u.id) : [...g.memberIds, u.id],
                      })
                    }
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[11px] transition-colors",
                      on ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted",
                      readOnly && "cursor-default opacity-70",
                    )}
                  >
                    {u.name} <span className="text-muted-foreground">· {u.department}</span>
                  </button>
                );
              })}
            </div>
            {g.memberIds.length > 0 && (
              <div className="mt-2">
                <Badge variant="secondary" className="text-[10px]">{g.memberIds.length} user{g.memberIds.length === 1 ? "" : "s"}</Badge>
              </div>
            )}
          </div>
        ))}
        {!readOnly && (
          <Button variant="outline" size="sm" onClick={add}><Plus className="mr-1 h-3.5 w-3.5" /> Add step</Button>
        )}
      </CardContent>
    </Card>
  );
}
