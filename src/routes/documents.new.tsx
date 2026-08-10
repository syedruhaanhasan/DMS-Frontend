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
  Highlighter, Palette, Quote, Type, Sparkles, Download,
} from "lucide-react";
import { AttachmentIcon } from "@/components/wdas/attachments";
import { ApprovalFlowChart } from "@/components/wdas/approval-flow-chart";
import { downloadHtmlAsPdf } from "@/lib/wdas/download-html-pdf";
import { attachmentSizeError, formatAttachmentSizeLimit } from "@/lib/wdas/attachment-limits";
import type { Attachment } from "@/lib/wdas/types";

export const Route = createFileRoute("/documents/new")({
  component: NewDoc,
});

function isBodyEmpty(html: string): boolean {
  if (!html.trim()) return true;
  const el = document.createElement("div");
  el.innerHTML = html;
  return !el.textContent?.trim() && el.querySelectorAll("img").length === 0;
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
  const [workflowApproverIds, setWorkflowApproverIds] = useState<string[]>([]);
  const [reviewerIds, setReviewerIds] = useState<string[]>([]);
  const [downloadAllowedIds, setDownloadAllowedIds] = useState<string[]>([]);
  const [reviewerQuery, setReviewerQuery] = useState("");
  const [reviewerFocused, setReviewerFocused] = useState(false);
  const [approverQuery, setApproverQuery] = useState("");
  const [approverFocused, setApproverFocused] = useState(false);
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
  const [fontSize, setFontSize] = useState("3");
  const [textColor, setTextColor] = useState("#d97706");
  const [highlightColor, setHighlightColor] = useState("#fef3c7");
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [savedDocId, setSavedDocId] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef("");
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const workflow = workflows.find((w) => w.id === workflowId);
  const isFinancial = workflow?.type === "financial";
  const isParallel = workflow?.approvalSequence === "parallel";
  const amountNum = amount ? Number(amount.replace(/,/g, "")) : undefined;

  const approvalFlowNodes = [
    {
      id: `creator-${user.id}`,
      label: user.name,
      sub: user.designation || user.department || "Document owner",
      role: "creator" as const,
    },
    ...toIds.map((id) => {
      const u = users.find((x) => x.id === id);
      return {
        id,
        label: u?.name ?? id,
        sub: u?.designation || u?.department || "Approver",
        role: "approver" as const,
      };
    }),
    ...reviewerIds.map((id) => {
      const u = users.find((x) => x.id === id);
      return {
        id: `reviewer-${id}`,
        label: u?.name ?? id,
        sub: u?.designation || u?.department || "Reviewer",
        role: "reviewer" as const,
        // Reviewers added on the New Document screen belong to the creator.
        addedBy: `creator-${user.id}`,
      };
    }),
  ];

  const moveInList = (list: string[], fromId: string, toId: string): string[] => {
    const from = list.indexOf(fromId);
    const to = list.indexOf(toId);
    if (from < 0 || to < 0 || from === to) return list;
    const next = [...list];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
  };

  // Drag-to-reorder from the sequence chart. Approver node ids are plain user ids;
  // reviewer node ids are prefixed with "reviewer-". Only reorder within the same group.
  const reorderSequence = (fromId: string, toId: string) => {
    if (toIds.includes(fromId) && toIds.includes(toId)) {
      setToIds((ids) => moveInList(ids, fromId, toId));
      return;
    }
    const prefix = "reviewer-";
    if (fromId.startsWith(prefix) && toId.startsWith(prefix)) {
      const from = fromId.slice(prefix.length);
      const to = toId.slice(prefix.length);
      setReviewerIds((ids) => moveInList(ids, from, to));
    }
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

  // Prefill Approvers from the users configured on the selected workflow.
  useEffect(() => {
    if (!workflowId) {
      setWorkflowApproverIds([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const full = await wdasConfig.getWorkflowRouting(workflowId);
        if (cancelled) return;
        // Workflows can store fixed approvers in different places depending on approval mode:
        // - user/hybrid: `approverUserIds` or `groups.memberIds`
        // - matrix: approvers live inside the matching `matrixBands[*].approverUserIds`
        let fromWorkflow: string[] = [];
        if (full.approverUserIds?.length) {
          fromWorkflow = full.approverUserIds;
        } else if (full.groups?.length) {
          fromWorkflow = full.groups.flatMap((g) => g.memberIds);
        } else if (full.matrixBands?.length) {
          const sampleAmount = amountNum ?? 0;
          const band =
            full.matrixBands.find(
              (b) => sampleAmount >= b.min && (b.max === null || sampleAmount <= b.max),
            ) ?? full.matrixBands.find((b) => (b.approverUserIds?.length ?? 0) > 0) ?? full.matrixBands[0];
          fromWorkflow = band?.approverUserIds ?? [];
        }
        const seen = new Set<string>();
        const next = fromWorkflow.filter((id) => {
          if (!id || id === user.id || seen.has(id)) return false;
          seen.add(id);
          return true;
        });
        setToIds((prev) => {
          // Keep creator-added approvers when the workflow/band refreshes.
          const previousWorkflow = new Set(workflowApproverIds);
          const extras = prev.filter((id) => !previousWorkflow.has(id) && !next.includes(id) && id !== user.id);
          return [...next, ...extras];
        });
        setWorkflowApproverIds(next);
        setReviewerIds((rev) => rev.filter((id) => !next.includes(id)));
      } catch {
        /* leave current approvers if workflow detail cannot be loaded */
      }
    })();
    return () => { cancelled = true; };
  }, [workflowId, user.id, amountNum]);

  useEffect(() => {
    const eligible = Array.from(new Set([...toIds, ...reviewerIds]));
    setDownloadAllowedIds((prev) => {
      const kept = prev.filter((id) => eligible.includes(id));
      const added = eligible.filter((id) => !kept.includes(id));
      // New reviewers/approvers can download by default; creator can uncheck.
      return [...kept, ...added];
    });
  }, [toIds, reviewerIds]);

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

  const downloadContentPdf = async () => {
    const content = readBodyFromEditor();
    const attachmentNote =
      attachments.length > 0
        ? `<hr/><p><strong>Attachments</strong></p><ul>${attachments
            .map((a) => `<li>${a.name}${a.size ? ` (${a.size})` : ""}</li>`)
            .join("")}</ul>`
        : "";

    setDownloadingPdf(true);
    try {
      await downloadHtmlAsPdf({
        title: subject.trim() || "Untitled document",
        html: `${content}${attachmentNote}`,
        meta: [
          { label: "Owner", value: user.name },
          { label: "Department", value: user.department ?? "" },
          { label: "Priority", value: priority },
          { label: "Workflow", value: workflow?.name ?? "" },
          ...(amountNum ? [{ label: "Amount", value: formatPKR(amountNum) }] : []),
        ],
        fileName: subject.trim() || "document",
      });
      toast.success("PDF downloaded", {
        description: "Editor content and attached file names are included.",
      });
    } catch (e) {
      toast.error((e as Error).message || "Could not download PDF");
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Autosave sim
  useEffect(() => {
    if (!subject && isBodyEmpty(body)) return;
    setSaveStatus("saving");
    const t = setTimeout(() => setSaveStatus("saved"), 800);
    return () => clearTimeout(t);
  }, [subject, body, toIds, reviewerIds, workflowId, amount, priority]);

  const isValid = subject.trim() && workflowId && toIds.length > 0
    && (!amountMandatory || (amountNum != null && amountNum > 0));

  const reviewerCandidates = users.filter((u) => {
    if (u.id === user.id || toIds.includes(u.id) || reviewerIds.includes(u.id)) return false;
    if (u.isActive === false) return false;
    if (!reviewerQuery.trim()) return true;
    const q = reviewerQuery.toLowerCase();
    const name = (u.name ?? "").toLowerCase();
    const dept = (u.department ?? "").toLowerCase();
    const email = (u.email ?? "").toLowerCase();
    const designation = (u.designation ?? "").toLowerCase();
    return name.includes(q) || dept.includes(q) || email.includes(q) || designation.includes(q);
  }).slice(0, 8);

  const approverCandidates = users.filter((u) => {
    if (u.id === user.id || toIds.includes(u.id) || reviewerIds.includes(u.id)) return false;
    if (u.isActive === false) return false;
    if (!approverQuery.trim()) return true;
    const q = approverQuery.toLowerCase();
    const name = (u.name ?? "").toLowerCase();
    const dept = (u.department ?? "").toLowerCase();
    const email = (u.email ?? "").toLowerCase();
    const designation = (u.designation ?? "").toLowerCase();
    return name.includes(q) || dept.includes(q) || email.includes(q) || designation.includes(q);
  }).slice(0, 8);

  const showReviewerPicker = reviewerFocused || reviewerQuery.trim().length > 0;
  const showApproverPicker = approverFocused || approverQuery.trim().length > 0;
  const wizardSteps = [
    { number: 1, label: "Details", href: "#document-details", complete: Boolean(subject.trim() && workflowId) },
    { number: 2, label: "Content", href: "#document-content", complete: !editorEmpty },
    { number: 3, label: "Workflow", href: "#document-workflow", complete: toIds.length > 0 },
    { number: 4, label: "Review & Submit", href: "#document-review", complete: Boolean(isValid) },
  ];

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((f) => {
      const sizeError = attachmentSizeError(f);
      if (sizeError) {
        toast.error(sizeError);
        return;
      }
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
      const payload = {
        subject: subject.trim(),
        body: readBodyFromEditor(),
        ownerId: user.id,
        toIds,
        reviewerIds,
        downloadAllowedUserIds: downloadAllowedIds.filter((id) => toIds.includes(id) || reviewerIds.includes(id)),
        workflowId,
        amount: amountNum,
        priority,
        attachments,
        directoryUsers: users,
      };

      const doc = savedDocId
        ? await wdas.updateDocument(
            savedDocId,
            {
              subject: payload.subject,
              body: payload.body,
              toIds: payload.toIds,
              amount: payload.amount,
              priority: payload.priority,
              directoryUsers: users,
              downloadAllowedUserIds: payload.downloadAllowedUserIds,
              reviewerIds: payload.reviewerIds,
            },
            !asDraft,
            pendingFiles,
          )
        : await wdas.createDocument(payload, !asDraft, pendingFiles);

      setSavedDocId(doc.id);
      setPendingFiles([]);
      toast.success(
        asDraft
          ? "Draft saved"
          : doc.status === "pending_reviewer"
            ? "Sent to reviewer — it will go to the approver after you send it for approval"
            : "Document submitted for approval",
      );
      void qc.invalidateQueries({ queryKey: ["docs"] });
      void qc.invalidateQueries({ queryKey: ["dashboard", "me"] });
      void qc.invalidateQueries({ queryKey: ["docs", "review"] });
      setConfirm(false);

      if (asDraft) {
        // Stay on the form so Download PDF becomes available after save.
        return;
      }

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

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";

    if (!file.type.startsWith("image/")) {
      toast.error("Only image files can be inserted into the document body.");
      return;
    }

    const sizeError = attachmentSizeError(file);
    if (sizeError) {
      toast.error(sizeError);
      return;
    }

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
  };

  return (
    <div>
      <PageHeader
        title="New Document"
        subtitle="Draft, attach, and route for approval."
        actions={
          <div className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-stone-600 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-stone-300">
            {saveStatus === "idle" && <><span className="h-2 w-2 rounded-full bg-stone-300 dark:bg-stone-500" /> Autosave ready</>}
            {saveStatus === "saving" && <><Loader2 className="h-3 w-3 animate-spin text-amber-700 dark:text-amber-400" /> Autosaving…</>}
            {saveStatus === "saved" && <><Check className="h-3 w-3 text-amber-700 dark:text-amber-400" /> All changes saved</>}
          </div>
        }
      />

      <div className="border-b border-amber-200/70 bg-amber-50/50 px-6 py-5 dark:border-amber-400/20 dark:bg-amber-400/5">
        <nav className="mx-auto grid max-w-5xl grid-cols-2 gap-3 md:grid-cols-4" aria-label="Document creation steps">
          {wizardSteps.map((step, index) => (
            <a
              key={step.number}
              href={step.href}
              className="group flex items-center gap-3 rounded-xl border border-amber-200 bg-white px-3 py-3 shadow-sm transition-colors hover:border-amber-400 hover:bg-amber-50 dark:border-amber-400/20 dark:bg-card dark:hover:bg-amber-400/10"
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                step.complete ? "bg-amber-500 text-stone-950" : "bg-stone-900 text-amber-100 dark:bg-stone-700 dark:text-amber-200"
              }`}>
                {step.complete ? <Check className="h-4 w-4" /> : step.number}
              </span>
              <span className="min-w-0">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-400">Step {step.number}</span>
                <span className="block truncate text-sm font-semibold text-stone-900 dark:text-foreground">{step.label}</span>
              </span>
              {index < wizardSteps.length - 1 && <span className="sr-only">Next step</span>}
            </a>
          ))}
        </nav>
      </div>

      <div className="grid gap-6 bg-stone-50/50 p-6 dark:bg-background lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card id="document-details" className="scroll-mt-6 border-amber-200/70 shadow-sm dark:border-amber-500/25">
            <CardHeader className="border-b border-amber-100 bg-amber-50/50 dark:border-amber-500/20 dark:bg-amber-500/10">
              <CardTitle className="flex items-center gap-2 text-sm text-stone-900 dark:text-foreground">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-stone-900 text-[11px] text-amber-100 dark:bg-stone-700 dark:text-amber-200">1</span>
                Details
              </CardTitle>
            </CardHeader>
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

              <div id="document-workflow" className="scroll-mt-6 space-y-2 rounded-xl border border-amber-200/70 bg-amber-50/30 p-4 dark:border-amber-500/25 dark:bg-amber-500/10">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-stone-900 text-[11px] font-semibold text-amber-100 dark:bg-stone-700 dark:text-amber-200">3</span>
                  <div>
                    <p className="text-sm font-semibold text-stone-900 dark:text-foreground">Workflow</p>
                    <p className="text-[11px] text-muted-foreground">Approvers come from the workflow — you can also add more. Add reviewers if others should review first.</p>
                  </div>
                </div>
                <Label>Approvers</Label>
                <p className="text-xs text-muted-foreground">
                  {workflowId
                    ? isParallel
                      ? "Workflow approvers are included. You can also add more people. Tick who may download."
                      : "Workflow approvers are included. You can also add more people outside the workflow. Tick who may download."
                    : "Choose a workflow first — its configured approvers will appear here. You can add more after that."}
                </p>
                <div className="space-y-1.5 rounded-md border bg-muted/20 p-2">
                  {toIds.length === 0 && (
                    <p className="px-1 py-1 text-sm text-muted-foreground">No approvers yet — select a workflow or add one below.</p>
                  )}
                  {toIds.map((id, index) => {
                    const u = users.find((x) => x.id === id);
                    const canDownload = downloadAllowedIds.includes(id);
                    const fromWorkflow = workflowApproverIds.includes(id);
                    return (
                      <div
                        key={id}
                        className="flex items-center gap-2 rounded-md border border-transparent bg-muted/40 px-2 py-1.5 text-sm"
                      >
                        {!isParallel && (
                          <span className="w-5 shrink-0 text-center text-[11px] font-semibold text-muted-foreground">{index + 1}</span>
                        )}
                        <span className="min-w-0 flex-1 truncate">
                          {u?.name ?? id}
                          {u?.designation ? <span className="text-muted-foreground"> — {u.designation}</span> : null}
                          {fromWorkflow ? (
                            <Badge variant="outline" className="ml-2 align-middle text-[10px]">Workflow</Badge>
                          ) : (
                            <Badge variant="secondary" className="ml-2 align-middle text-[10px]">Added</Badge>
                          )}
                        </span>
                        {!fromWorkflow && (
                          <button
                            type="button"
                            className="shrink-0 rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground"
                            aria-label="Remove approver"
                            onClick={() => {
                              setToIds((ids) => ids.filter((x) => x !== id));
                              setDownloadAllowedIds((ids) => ids.filter((x) => x !== id));
                            }}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                          <Checkbox
                            checked={canDownload}
                            onCheckedChange={(checked) => {
                              const on = checked === true;
                              setDownloadAllowedIds((prev) =>
                                on ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((x) => x !== id),
                              );
                            }}
                          />
                          Can download
                        </label>
                      </div>
                    );
                  })}
                  {workflowId && (
                    <input
                      className="min-w-[120px] w-full flex-1 border-0 bg-transparent p-1 text-sm outline-none"
                      placeholder="Search to add another approver…"
                      value={approverQuery}
                      onChange={(e) => setApproverQuery(e.target.value)}
                      onFocus={() => setApproverFocused(true)}
                      onBlur={() => {
                        window.setTimeout(() => setApproverFocused(false), 150);
                      }}
                    />
                  )}
                </div>
                {workflowId && showApproverPicker && (
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
                    ) : approverCandidates.length > 0 ? (
                      approverCandidates.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setToIds((ids) => (ids.includes(u.id) ? ids : [...ids, u.id]));
                            setReviewerIds((ids) => ids.filter((id) => id !== u.id));
                            setApproverQuery("");
                            setApproverFocused(true);
                          }}
                        >
                          <span>{u.name} <span className="text-muted-foreground">— {u.designation || u.email}</span></span>
                          <span className="text-xs text-muted-foreground">{u.department}</span>
                        </button>
                      ))
                    ) : (
                      <p className="px-3 py-2 text-sm text-muted-foreground">
                        {approverQuery.trim() ? "No matching users." : "No other active users available."}
                      </p>
                    )}
                  </div>
                )}

                <div className="pt-3">
                  <Label>Reviewer</Label>
                  <p className="text-xs text-muted-foreground">
                    Optional. When added, the document goes to the reviewer first. After they complete review it returns to you, then you send it to the approver.
                  </p>
                  <div className="mt-1 space-y-1.5 rounded-md border p-2">
                    {reviewerIds.map((id) => {
                      const u = users.find((x) => x.id === id);
                      const canDownload = downloadAllowedIds.includes(id);
                      return (
                        <div key={id} className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1.5 text-sm">
                          <Badge variant="secondary" className="gap-1">
                            {u?.name ?? id}
                            <button type="button" onClick={() => setReviewerIds((ids) => ids.filter((i) => i !== id))} aria-label="Remove reviewer">
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                            {u?.designation || u?.department || ""}
                          </span>
                          <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                            <Checkbox
                              checked={canDownload}
                              onCheckedChange={(checked) => {
                                const on = checked === true;
                                setDownloadAllowedIds((prev) =>
                                  on ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((x) => x !== id),
                                );
                              }}
                            />
                            Can download
                          </label>
                        </div>
                      );
                    })}
                    {reviewerIds.length === 0 && (
                      <input
                        className="min-w-[120px] w-full flex-1 border-0 bg-transparent p-1 text-sm outline-none"
                        placeholder="Search or pick a reviewer…"
                        value={reviewerQuery}
                        onChange={(e) => setReviewerQuery(e.target.value)}
                        onFocus={() => setReviewerFocused(true)}
                        onBlur={() => {
                          window.setTimeout(() => setReviewerFocused(false), 150);
                        }}
                      />
                    )}
                  </div>
                  {reviewerIds.length === 0 && showReviewerPicker && (
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
                      ) : reviewerCandidates.length > 0 ? (
                        reviewerCandidates.map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setReviewerIds((ids) => [...ids, u.id]);
                              setReviewerQuery("");
                              setReviewerFocused(true);
                            }}
                          >
                            <span>{u.name} <span className="text-muted-foreground">— {u.designation || u.email}</span></span>
                            <span className="text-xs text-muted-foreground">{u.department}</span>
                          </button>
                        ))
                      ) : (
                        <p className="px-3 py-2 text-sm text-muted-foreground">
                          {reviewerQuery.trim() ? "No matching users." : "No other active users available."}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Subject <span className="text-destructive">*</span></Label>
                  <span className="text-xs text-muted-foreground">{subject.length}/120</span>
                </div>
                <Input value={subject} onChange={(e) => setSubject(e.target.value.slice(0, 120))} placeholder="Concise, action-oriented subject" />
              </div>

              {workflowId && (
                <div className="space-y-2">
                  <div>
                    <p className="text-xs font-medium text-foreground">Sequence chart</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Creator, workflow approvers, any extra approvers you add, and reviewers.
                    </p>
                  </div>
                  <ApprovalFlowChart
                    nodes={toIds.length > 0 || reviewerIds.length > 0 ? approvalFlowNodes : [{ ...approvalFlowNodes[0] }]}
                    mode={isParallel ? "parallel" : "sequential"}
                    onReorder={isParallel ? undefined : reorderSequence}
                  />
                  {toIds.length === 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      Select a workflow to populate the approval chart.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card id="document-content" className="scroll-mt-6 border-amber-200/70 shadow-sm dark:border-amber-500/25">
            <div className="sticky top-0 z-20 border-b border-border bg-card/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80">
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-sm text-foreground">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-stone-900 text-[11px] text-amber-100 dark:bg-stone-700 dark:text-amber-200">2</span>
                    Content
                  </CardTitle>
                  {savedDocId && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200 dark:hover:bg-amber-500/20"
                      disabled={downloadingPdf || editorEmpty}
                      onClick={() => void downloadContentPdf()}
                    >
                      {downloadingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                      Download PDF
                    </Button>
                  )}
                </div>
              </CardHeader>
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
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => {
                      setTextColor(e.target.value);
                      applyFormat("foreColor", e.target.value);
                    }}
                    className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0"
                  />
                </label>
                <label className="flex items-center gap-2 rounded-md border bg-background px-2 py-1 text-sm">
                  <Highlighter className="h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="color"
                    value={highlightColor}
                    onChange={(e) => {
                      setHighlightColor(e.target.value);
                      applyFormat("hiliteColor", e.target.value);
                    }}
                    className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0"
                  />
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
                  onPaste={(e) => {
                    // Prefer clipboard HTML so Word/Outlook paste keeps WYSIWYG formatting.
                    const html = e.clipboardData.getData("text/html");
                    if (!html) return;
                    e.preventDefault();
                    document.execCommand("insertHTML", false, html);
                    handleEditorInput();
                  }}
                  className="wysiwyg-content min-h-[320px] rounded-md border bg-card p-4 text-sm text-foreground outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-200/70 shadow-sm dark:border-amber-500/25">
            <CardHeader><CardTitle className="text-sm">Content attachments</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <label
                htmlFor="upload"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border bg-muted/30 p-6 text-center hover:bg-muted/50"
              >
                <UploadCloud className="h-6 w-6 text-muted-foreground" />
                <p className="text-sm font-medium">Drop files here or click to upload</p>
                <p className="text-xs text-muted-foreground">
                  Accepted: PDF, Word, Excel, PPT, PNG/JPG · Max {formatAttachmentSizeLimit()} each
                </p>
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
            <Card id="document-review" className="scroll-mt-6 border-stone-800 shadow-md">
              <CardHeader className="bg-stone-950 text-white">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-[11px] text-stone-950">4</span>
                  Review & Submit
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {savedDocId && (
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={downloadingPdf || editorEmpty}
                    onClick={() => void downloadContentPdf()}
                  >
                    {downloadingPdf ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparing PDF…</> : <><Download className="mr-2 h-4 w-4" /> Download PDF</>}
                  </Button>
                )}
                <Button variant="outline" className="w-full" disabled={submitting || !subject.trim() || !workflowId} onClick={() => submit(true)}>
                  {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</> : savedDocId ? "Update draft" : "Save as Draft"}
                </Button>
                <Button className="w-full bg-amber-500 font-semibold text-stone-950 hover:bg-amber-400" disabled={!isValid || submitting} onClick={() => setConfirm(true)}>
                  Submit for approval
                </Button>
                {!savedDocId && (
                  <p className="text-xs text-muted-foreground">
                    Save as draft or submit to unlock PDF download.
                  </p>
                )}
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
