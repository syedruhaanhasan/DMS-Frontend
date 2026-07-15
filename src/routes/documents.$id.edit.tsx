import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { wdas } from "@/services/wdas";
import { useSession } from "@/lib/wdas/role-context";
import { useUsers } from "@/lib/wdas/users-context";
import { useDocumentQuery, useCanFetchDocuments } from "@/lib/wdas/use-document-query";
import { ApiError } from "@/lib/api/client";
import { LoadingState, ErrorState } from "@/components/wdas/data-states";
import { PageHeader } from "@/components/wdas/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/wdas/confirm-dialog";
import type { Priority } from "@/lib/wdas/types";

export const Route = createFileRoute("/documents/$id/edit")({
  component: EditDocumentPage,
});

function isBodyEmpty(html: string): boolean {
  if (!html.trim()) return true;
  const el = document.createElement("div");
  el.innerHTML = html;
  return !el.textContent?.trim();
}

function EditDocumentPage() {
  const { id } = Route.useParams();
  const { user } = useSession();
  const { users } = useUsers();
  const qc = useQueryClient();
  const router = useRouter();
  const canFetch = useCanFetchDocuments();
  const q = useDocumentQuery(id);

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [amount, setAmount] = useState("");
  const [priority, setPriority] = useState<Priority>("Normal");
  const [hydrated, setHydrated] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (!q.data || hydratedRef.current) return;
    const doc = q.data;
    if (doc.ownerId !== user.id) {
      toast.error("Only the document owner can update this document.");
      void router.navigate({ to: "/documents/$id", params: { id } });
      return;
    }
    if (doc.status !== "draft" && doc.status !== "returned") {
      toast.error("This document cannot be edited in its current state. Click Update on the detail page first.");
      void router.navigate({ to: "/documents/$id", params: { id } });
      return;
    }
    setSubject(doc.subject);
    setBody(doc.body || "");
    setAmount(doc.amount != null ? String(doc.amount) : "");
    setPriority(doc.priority);
    hydratedRef.current = true;
    setHydrated(true);
  }, [q.data, user.id, id, router]);

  useEffect(() => {
    if (!hydrated || !editorRef.current) return;
    editorRef.current.innerHTML = body || "<p><br></p>";
  }, [hydrated]); // intentionally once after hydrate

  if (!canFetch) return <LoadingState />;
  if (q.isLoading || !hydrated) return <LoadingState />;
  if (q.isError || !q.data) {
    const message = q.error instanceof ApiError ? q.error.message : "Document not available.";
    return <ErrorState message={message} onRetry={() => q.refetch()} />;
  }

  const doc = q.data;
  const amountNum = amount ? Number(amount.replace(/,/g, "")) : undefined;
  const isValid = subject.trim().length > 0 && !isBodyEmpty(body);

  const readBody = () => {
    const html = editorRef.current?.innerHTML ?? body;
    return isBodyEmpty(html) ? "" : html;
  };

  const save = async (submit: boolean) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const bodyHtml = readBody();
      const updated = await wdas.updateDocument(
        doc.id,
        {
          subject: subject.trim(),
          body: bodyHtml,
          toIds: doc.toIds,
          amount: amountNum,
          priority,
          directoryUsers: users,
        },
        submit,
      );
      qc.setQueryData(["doc", doc.id], updated);
      toast.success(
        submit
          ? `v${updated.revisionNumber ?? doc.revisionNumber ?? 1} submitted for approval`
          : "Changes saved",
      );
      void qc.invalidateQueries({ queryKey: ["docs"] });
      void qc.invalidateQueries({ queryKey: ["dashboard", "me"] });
      setConfirm(false);
      await router.navigate({ to: "/documents/$id", params: { id: doc.id } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={`Update document · v${doc.revisionNumber ?? 1}`}
        subtitle="Revise the content, then resubmit for approval."
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link to="/documents/$id" params={{ id: doc.id }}>
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 p-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Subject</CardTitle>
            </CardHeader>
            <CardContent>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Document body</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                className="min-h-[220px] rounded-md border bg-background p-3 prose prose-sm max-w-none focus:outline-none focus:ring-2 focus:ring-ring"
                onInput={() => {
                  const html = editorRef.current?.innerHTML ?? "";
                  setBody(isBodyEmpty(html) ? "" : html);
                }}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>Amount (optional)</Label>
                <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Normal">Normal</SelectItem>
                    <SelectItem value="Urgent">Urgent</SelectItem>
                    <SelectItem value="Critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Record #{doc.refId ?? "—"} · Version v{doc.revisionNumber ?? 1}
              </p>
            </CardContent>
          </Card>

          <Button className="w-full" disabled={!isValid || submitting} onClick={() => setConfirm(true)}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
            Resubmit for approval
          </Button>
          <Button
            variant="outline"
            className="w-full"
            disabled={!isValid || submitting}
            onClick={() => void save(false)}
          >
            Save without submitting
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Resubmit this version?"
        description={`Version v${doc.revisionNumber ?? 1} will go through the approval workflow again.`}
        confirmLabel="Resubmit"
        onConfirm={() => save(true)}
      />
    </div>
  );
}
