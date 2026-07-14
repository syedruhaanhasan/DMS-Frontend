import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/wdas/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { wdasConfig } from "@/services/wdas-config";
import { Checkbox } from "@/components/ui/checkbox";
import { useSession } from "@/lib/wdas/role-context";
import { useUsers } from "@/lib/wdas/users-context";
import { wdas } from "@/services/wdas";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/wdas/confirm-dialog";
import { formatPKR } from "@/lib/wdas/format";
import type { Priority } from "@/lib/wdas/types";
import {
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Heading1, Heading2, Table as TableIcon, Image as ImageIcon,
  Link2, Minus, Undo2, Redo2, Check, X, UploadCloud, FileText, Loader2,
  Highlighter, Palette, Quote, Type, Sparkles, ChevronUp, ChevronDown,
} from "lucide-react";
import { AttachmentIcon } from "@/components/wdas/attachments";
import type { Attachment } from "@/lib/wdas/types";

export const Route = createFileRoute("/documents/new")({
  component: NewDoc,
});

function isBodyEmpty(html: string): boolean {
  if (!html.trim()) return true;
  const el = document.createElement("div");
  el.innerHTML = html;
  return !el.textContent?.trim();
}

const EMPTY_EDITOR_HTML = "<p><br></p>";

function NewDoc() {
  const { user } = useSession();
  const { users, isLoading: usersLoading, isError: usersError, refetch: refetchUsers } = useUsers();
  const router = useRouter();
  const qc = useQueryClient();

  const workflowsQ = useQuery({ queryKey: ["workflows"], queryFn: () => wdas.workflows() });
  const documentTypesQ = useQuery({ queryKey: ["document-types"], queryFn: () => wdasConfig.listDocumentTypes() });
  const workflows = (workflowsQ.data ?? []).filter((w) => w.isActive !== false && w.status === "active");

  const [subject, setSubject] = useState("");
  const [toIds, setToIds] = useState<string[]>([]);
  const [toQuery, setToQuery] = useState("");
  const [toFocused, setToFocused] = useState(false);
  const [workflowId, setWorkflowId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [amountMandatory, setAmountMandatory] = useState(false);
  const [priority, setPriority] = useState<Priority>("Normal");
  const [body, setBody] = useState("");
  const [editorFocused, setEditorFocused] = useState(false);
  const [editorEmpty, setEditorEmpty] = useState(true);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState<{ name: string; state: "uploading" | "scanning" }[]>([]);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fontFamily, setFontFamily] = useState("Inter");
  const [fontSize, setFontSize] = useState("16");
  const [textColor, setTextColor] = useState("#2563eb");
  const [highlightColor, setHighlightColor] = useState("#fef3c7");
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef("");
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const workflow = workflows.find((w) => w.id === workflowId);
  const isFinancial = workflow?.type === "financial";
  const isParallel = workflow?.approvalSequence === "parallel";
  const amountNum = amount ? Number(amount.replace(/,/g, "")) : undefined;

  const moveApprover = (id: string, direction: -1 | 1) => {
    setToIds((ids) => {
      const index = ids.indexOf(id);
      if (index < 0) return ids;
      const target = index + direction;
      if (target < 0 || target >= ids.length) return ids;
      const next = [...ids];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  useEffect(() => {
    if (!workflow) {
      setAmountMandatory(false);
      return;
    }
    const docType = (documentTypesQ.data ?? []).find(
      (t) => t.code === workflow.documentType || t.name === workflow.documentType,
    );
    const mandatory = isFinancial && (docType?.amountRequired ?? true);
    setAmountMandatory(mandatory);
    if (!mandatory) setAmount("");
  }, [workflowId, workflow, isFinancial, documentTypesQ.data]);

  useEffect(() => {
    const el = editorRef.current;
    if (el && el.innerHTML === "") {
      el.innerHTML = EMPTY_EDITOR_HTML;
    }
    return () => clearTimeout(autosaveTimerRef.current);
  }, []);

  const readBodyFromEditor = (): string => {
    const el = editorRef.current;
    if (!el) return bodyRef.current;
    const html = el.innerHTML;
    return isBodyEmpty(html) ? "" : html;
  };

  const handleEditorInput = () => {
    const el = editorRef.current;
    if (!el) return;
    const empty = isBodyEmpty(el.innerHTML);
    setEditorEmpty((prev) => (prev === empty ? prev : empty));
    bodyRef.current = empty ? "" : el.innerHTML;
    clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => setBody(bodyRef.current), 400);
  };

  const handleEditorBlur = () => {
    setEditorFocused(false);
    const el = editorRef.current;
    if (!el) return;
    if (isBodyEmpty(el.innerHTML)) {
      el.innerHTML = EMPTY_EDITOR_HTML;
      setEditorEmpty(true);
      bodyRef.current = "";
      setBody("");
    } else {
      bodyRef.current = el.innerHTML;
      setBody(el.innerHTML);
      setEditorEmpty(false);
    }
  };

  // Autosave sim
  useEffect(() => {
    if (!subject && isBodyEmpty(body)) return;
    setSaveStatus("saving");
    const t = setTimeout(() => setSaveStatus("saved"), 800);
    return () => clearTimeout(t);
  }, [subject, body, toIds, workflowId, amount, priority]);

  const isValid = subject.trim() && workflowId && toIds.length > 0
    && (!amountMandatory || (amountNum != null && amountNum > 0));

  const filteredUsers = users.filter((u) => {
    if (u.id === user.id || toIds.includes(u.id)) return false;
    if (u.isActive === false) return false;
    if (!toQuery.trim()) return true;
    const q = toQuery.toLowerCase();
    const name = (u.name ?? "").toLowerCase();
    const dept = (u.department ?? "").toLowerCase();
    const email = (u.email ?? "").toLowerCase();
    const designation = (u.designation ?? "").toLowerCase();
    return name.includes(q) || dept.includes(q) || email.includes(q) || designation.includes(q);
  }).slice(0, 8);

  const showApproverPicker = toFocused || toQuery.trim().length > 0;

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((f) => {
      setPendingFiles((p) => [...p, f]);
      const ext = f.name.split(".").pop()?.toLowerCase();
      const type: Attachment["type"] = ext === "pdf" ? "pdf" : ext === "xlsx" || ext === "xls" ? "excel" : ext === "pptx" ? "ppt" : ext === "png" || ext === "jpg" || ext === "jpeg" ? "image" : "word";
      setAttachments((a) => [...a, { id: `pending-${Date.now()}-${f.name}`, name: f.name, type, size: `${Math.round(f.size / 1024)} KB` }]);
    });
  };

  const submit = async (asDraft: boolean) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const doc = await wdas.createDocument({
        subject: subject.trim(),
        body: readBodyFromEditor(),
        ownerId: user.id,
        toIds,
        workflowId,
        amount: amountNum,
        priority,
        attachments,
        directoryUsers: users,
      }, !asDraft, pendingFiles);
      toast.success(asDraft ? "Draft saved" : "Document submitted");
      // Only refresh document lists — do not invalidate the whole app cache.
      void qc.invalidateQueries({ queryKey: ["docs"] });
      void qc.invalidateQueries({ queryKey: ["dashboard", "me"] });
      setConfirm(false);
      router.navigate({ to: "/documents/$id", params: { id: doc.id } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const applyFormat = (cmd: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    handleEditorInput();
  };

  const applyFontStyle = (type: "family" | "size") => {
    if (type === "family") {
      applyFormat("fontName", fontFamily);
    } else {
      applyFormat("fontSize", fontSize);
    }
  };

  const handleTextColor = () => {
    applyFormat("foreColor", textColor);
  };

  const handleHighlightColor = () => {
    applyFormat("hiliteColor", highlightColor);
  };

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      applyFormat("insertImage", dataUrl);
      setAttachments((current) => [
        ...current,
        {
          id: `img-${Date.now()}`,
          name: file.name,
          type: "image",
          size: `${Math.round(file.size / 1024)} KB`,
        },
      ]);
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  return (
    <div>
      <PageHeader
        title="New Document"
        subtitle="Draft, attach, and route for approval."
        actions={
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {saveStatus === "saving" && <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>}
            {saveStatus === "saved" && <><Check className="h-3 w-3 text-success" /> All changes saved</>}
          </div>
        }
      />

      <div className="grid gap-6 p-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle className="text-sm">Header</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>From</Label>
                  <Input value={`${user.name} — ${user.designation}, ${user.department}`} readOnly className="bg-muted/50" />
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Normal">Normal</SelectItem>
                      <SelectItem value="Urgent">Urgent</SelectItem>
                      <SelectItem value="Critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Approvers <span className="text-destructive">*</span></Label>
                <p className="text-xs text-muted-foreground">
                  {workflowId
                    ? isParallel
                      ? "Select individual users — the document goes to all of them at the same time."
                      : "Select individual users in approval order — first selected approves first, then the next, and so on."
                    : "Choose a workflow first, then select the users who will approve this document."}
                </p>
                <div className="flex flex-wrap gap-1 rounded-md border p-2">
                  {toIds.map((id, index) => {
                    const u = users.find((x) => x.id === id);
                    return (
                      <div key={id} className="flex items-center gap-0.5">
                        <Badge variant="secondary" className="gap-1">
                          {!isParallel && <span className="text-[10px] font-semibold text-muted-foreground">{index + 1}.</span>}
                          {u?.name ?? id}
                          <button type="button" onClick={() => setToIds((ids) => ids.filter((i) => i !== id))} aria-label="Remove"><X className="h-3 w-3" /></button>
                        </Badge>
                        {!isParallel && (
                          <div className="flex flex-col">
                            <button
                              type="button"
                              className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
                              disabled={index === 0}
                              onClick={() => moveApprover(id, -1)}
                              aria-label="Move up"
                            >
                              <ChevronUp className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
                              disabled={index === toIds.length - 1}
                              onClick={() => moveApprover(id, 1)}
                              aria-label="Move down"
                            >
                              <ChevronDown className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <input
                    className="min-w-[120px] flex-1 border-0 bg-transparent p-1 text-sm outline-none"
                    placeholder={toIds.length ? "Add another…" : "Search or pick users…"}
                    value={toQuery}
                    onChange={(e) => setToQuery(e.target.value)}
                    onFocus={() => setToFocused(true)}
                    onBlur={() => {
                      // Delay so click on a suggestion still registers.
                      window.setTimeout(() => setToFocused(false), 150);
                    }}
                  />
                </div>
                {showApproverPicker && (
                  <div className="mt-1 max-h-56 overflow-y-auto rounded-md border bg-popover shadow">
                    {usersLoading ? (
                      <p className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading users…
                      </p>
                    ) : usersError ? (
                      <div className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                        <span className="text-destructive">Could not load users.</span>
                        <button type="button" className="text-primary hover:underline" onMouseDown={(e) => e.preventDefault()} onClick={() => refetchUsers()}>
                          Retry
                        </button>
                      </div>
                    ) : filteredUsers.length > 0 ? (
                      filteredUsers.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setToIds((ids) => [...ids, u.id]);
                            setToQuery("");
                            setToFocused(true);
                          }}
                        >
                          <span>{u.name} <span className="text-muted-foreground">— {u.designation || u.email}</span></span>
                          <span className="text-xs text-muted-foreground">{u.department}</span>
                        </button>
                      ))
                    ) : (
                      <p className="px-3 py-2 text-sm text-muted-foreground">
                        {toQuery.trim() ? "No matching users." : "No other active users available."}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Subject <span className="text-destructive">*</span></Label>
                  <span className="text-xs text-muted-foreground">{subject.length}/120</span>
                </div>
                <Input value={subject} onChange={(e) => setSubject(e.target.value.slice(0, 120))} placeholder="Concise, action-oriented subject" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Document Type / Workflow <span className="text-destructive">*</span></Label>
                  <Select value={workflowId} onValueChange={setWorkflowId}>
                    <SelectTrigger><SelectValue placeholder="Select a workflow" /></SelectTrigger>
                    <SelectContent>
                      {workflows.map((w) => (
                        <SelectItem key={w.id} value={w.id}>{w.name} <span className="text-muted-foreground">— {w.type === "financial" ? "Financial" : "Non-financial"}</span></SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {isFinancial && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2.5">
                      <Checkbox
                        id="amount-mandatory"
                        checked={amountMandatory}
                        onCheckedChange={(checked) => {
                          const on = checked === true;
                          setAmountMandatory(on);
                          if (!on) setAmount("");
                        }}
                      />
                      <Label htmlFor="amount-mandatory" className="cursor-pointer font-normal">
                        Amount is mandatory
                      </Label>
                    </div>
                    {amountMandatory && (
                      <div className="space-y-2">
                        <Label>Amount (PKR) <span className="text-destructive">*</span></Label>
                        <Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))} placeholder="e.g. 250000" />
                        {amountNum ? <p className="text-xs text-muted-foreground">{formatPKR(amountNum)}</p> : null}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {workflowId && toIds.length > 0 && (
                <div className="rounded-md border bg-muted/40 p-3">
                  <p className="text-xs font-medium text-foreground">Approval chain</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Routing: {isParallel ? "Parallel — all selected users receive the document at once" : "Sequential — users approve in the order shown"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {isParallel
                      ? toIds.map((id) => users.find((u) => u.id === id)?.name ?? id).join(", ")
                      : toIds.map((id, i) => {
                          const name = users.find((u) => u.id === id)?.name ?? id;
                          return i === 0 ? name : ` → ${name}`;
                        }).join("")}
                  </p>
                </div>
              )}
              {workflowId && toIds.length === 0 && (
                <div className="rounded-md border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Select at least one approver above to build the approval chain.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <div className="sticky top-0 z-20 border-b bg-card/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Body</CardTitle></CardHeader>
              <div className="space-y-2 px-6 pb-3">
                <div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/40 p-1">
                <ToolbarBtn onClick={() => applyFormat("bold")}><Bold className="h-3.5 w-3.5" /></ToolbarBtn>
                <ToolbarBtn onClick={() => applyFormat("italic")}><Italic className="h-3.5 w-3.5" /></ToolbarBtn>
                <ToolbarBtn onClick={() => applyFormat("underline")}><Underline className="h-3.5 w-3.5" /></ToolbarBtn>
                <Sep />
                <ToolbarBtn onClick={() => applyFormat("formatBlock", "H1")}><Heading1 className="h-3.5 w-3.5" /></ToolbarBtn>
                <ToolbarBtn onClick={() => applyFormat("formatBlock", "H2")}><Heading2 className="h-3.5 w-3.5" /></ToolbarBtn>
                <ToolbarBtn onClick={() => applyFormat("formatBlock", "blockquote")}><Quote className="h-3.5 w-3.5" /></ToolbarBtn>
                <Sep />
                <ToolbarBtn onClick={() => applyFormat("justifyLeft")}><AlignLeft className="h-3.5 w-3.5" /></ToolbarBtn>
                <ToolbarBtn onClick={() => applyFormat("justifyCenter")}><AlignCenter className="h-3.5 w-3.5" /></ToolbarBtn>
                <ToolbarBtn onClick={() => applyFormat("justifyRight")}><AlignRight className="h-3.5 w-3.5" /></ToolbarBtn>
                <Sep />
                <ToolbarBtn onClick={() => applyFormat("insertUnorderedList")}><List className="h-3.5 w-3.5" /></ToolbarBtn>
                <ToolbarBtn onClick={() => applyFormat("insertOrderedList")}><ListOrdered className="h-3.5 w-3.5" /></ToolbarBtn>
                <Sep />
                <ToolbarBtn onClick={() => applyFormat("insertHTML", "<table style='border-collapse:collapse;width:100%'><tr><td style='border:1px solid #d1d5db;padding:8px'>&nbsp;</td><td style='border:1px solid #d1d5db;padding:8px'>&nbsp;</td></tr><tr><td style='border:1px solid #d1d5db;padding:8px'>&nbsp;</td><td style='border:1px solid #d1d5db;padding:8px'>&nbsp;</td></tr></table>")}><TableIcon className="h-3.5 w-3.5" /></ToolbarBtn>
                <ToolbarBtn onClick={() => imageInputRef.current?.click()}><ImageIcon className="h-3.5 w-3.5" /></ToolbarBtn>
                <ToolbarBtn onClick={() => { const url = prompt("Link URL"); if (url) applyFormat("createLink", url); }}><Link2 className="h-3.5 w-3.5" /></ToolbarBtn>
                <ToolbarBtn onClick={() => applyFormat("insertHorizontalRule")}><Minus className="h-3.5 w-3.5" /></ToolbarBtn>
                <Sep />
                <ToolbarBtn onClick={() => applyFormat("undo")}><Undo2 className="h-3.5 w-3.5" /></ToolbarBtn>
                <ToolbarBtn onClick={() => applyFormat("redo")}><Redo2 className="h-3.5 w-3.5" /></ToolbarBtn>
              </div>

              <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-2">
                <div className="flex items-center gap-2 rounded-md border bg-background px-2 py-1">
                  <Type className="h-3.5 w-3.5 text-muted-foreground" />
                  <select value={fontFamily} onChange={(e) => { setFontFamily(e.target.value); applyFormat("fontName", e.target.value); }} className="bg-transparent text-sm outline-none">
                    <option value="Inter">Inter</option>
                    <option value="Arial">Arial</option>
                    <option value="Georgia">Georgia</option>
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Calibri">Calibri</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 rounded-md border bg-background px-2 py-1">
                  <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                  <select value={fontSize} onChange={(e) => { setFontSize(e.target.value); applyFormat("fontSize", e.target.value); }} className="bg-transparent text-sm outline-none">
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                    <option value="5">5</option>
                    <option value="6">6</option>
                    <option value="7">7</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 rounded-md border bg-background px-2 py-1 text-sm">
                  <Palette className="h-3.5 w-3.5 text-muted-foreground" />
                  <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} onBlur={handleTextColor} className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0" />
                </label>
                <label className="flex items-center gap-2 rounded-md border bg-background px-2 py-1 text-sm">
                  <Highlighter className="h-3.5 w-3.5 text-muted-foreground" />
                  <input type="color" value={highlightColor} onChange={(e) => setHighlightColor(e.target.value)} onBlur={handleHighlightColor} className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0" />
                </label>
                <Button type="button" variant="ghost" size="sm" onClick={() => applyFormat("removeFormat")}>Clear style</Button>
              </div>
              </div>
            </div>
            <CardContent className="space-y-2 pt-4">
              <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              <div className="relative">
                {!editorFocused && editorEmpty && (
                  <p className="pointer-events-none absolute inset-x-4 top-4 z-10 text-sm leading-7 text-muted-foreground">
                    Write your document here…
                  </p>
                )}
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onFocus={() => setEditorFocused(true)}
                  onBlur={handleEditorBlur}
                  onInput={handleEditorInput}
                  className="min-h-[320px] rounded-md border bg-card p-4 text-sm leading-7 outline-none focus:ring-2 focus:ring-ring [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:text-lg [&_h2]:font-semibold [&_blockquote]:rounded-md [&_blockquote]:border-l-4 [&_blockquote]:border-primary/30 [&_blockquote]:bg-muted/40 [&_blockquote]:p-3 [&_table]:w-full [&_table]:border-collapse [&_table_td]:border [&_table_td]:border-border [&_table_td]:p-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Attachments</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <label
                htmlFor="upload"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border bg-muted/30 p-6 text-center hover:bg-muted/50"
              >
                <UploadCloud className="h-6 w-6 text-muted-foreground" />
                <p className="text-sm font-medium">Drop files here or click to upload</p>
                <p className="text-xs text-muted-foreground">Accepted: PDF, Word, Excel, PPT, PNG/JPG</p>
                <input id="upload" type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
              </label>

              {uploading.map((u) => (
                <div key={u.name} className="flex items-center gap-3 rounded-md border bg-card p-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-info" />
                  <div className="flex-1">
                    <p className="font-medium">{u.name}</p>
                    <p className="text-xs text-muted-foreground">{u.state === "uploading" ? "Uploading…" : "Scanning…"}</p>
                  </div>
                </div>
              ))}

              {attachments.map((a) => (
                <div key={a.id} className="flex items-center gap-3 rounded-md border bg-card p-2 text-sm">
                  <AttachmentIcon type={a.type} />
                  <div className="flex-1">
                    <p className="font-medium">{a.name}</p>
                    <p className="text-xs text-muted-foreground">{a.size}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setAttachments((as) => as.filter((x) => x.id !== a.id))}><X className="h-3.5 w-3.5" /></Button>
                </div>
              ))}

              {!attachments.length && !uploading.length && (
                <p className="text-xs text-muted-foreground"><FileText className="mr-1 inline h-3 w-3" /> No attachments yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <div className="sticky top-0 z-10 space-y-3 self-start">
            <Card>
              <CardHeader><CardTitle className="text-sm">Actions</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full" disabled={submitting} onClick={() => submit(true)}>
                  {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</> : "Save as Draft"}
                </Button>
                <Button className="w-full" disabled={!isValid || submitting} onClick={() => setConfirm(true)}>
                  Submit for approval
                </Button>
                {!isValid && <p className="text-xs text-muted-foreground">Complete required fields to submit.</p>}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Submit for approval?"
        description={
          isParallel
            ? "The document will be sent to all of the following approvers at the same time:"
            : "The document will be routed to the following approvers in order:"
        }
        confirmLabel="Submit"
        onConfirm={() => submit(false)}
        extraContent={
          isParallel ? (
            <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
              {toIds.map((id) => (
                <li key={id}>{users.find((u) => u.id === id)?.name ?? id}</li>
              ))}
            </ul>
          ) : (
            <ol className="list-decimal space-y-1 pl-4 text-sm text-muted-foreground">
              {toIds.map((id) => (
                <li key={id}>{users.find((u) => u.id === id)?.name ?? id}</li>
              ))}
            </ol>
          )
        }
      />
    </div>
  );
}

function ToolbarBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className="rounded p-1.5 hover:bg-background">
      {children}
    </button>
  );
}
function Sep() { return <div className="mx-0.5 h-4 w-px bg-border" />; }
