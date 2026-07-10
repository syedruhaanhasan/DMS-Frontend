import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/wdas/page-header";
import { LoadingState, ErrorState, EmptyState } from "@/components/wdas/data-states";
import { useSession, isSuperAdmin } from "@/lib/wdas/role-context";
import { wdasConfig } from "@/services/wdas-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Mail, Plus, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { relTime } from "@/lib/wdas/format";
import type { OtpStatus } from "@/lib/wdas/types";

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const Route = createFileRoute("/config/external-approvers")({
  component: ExternalApproversPage,
});

function ExternalApproversPage() {
  const router = useRouter();
  const { hasRole } = useSession();
  const qc = useQueryClient();
  useEffect(() => { if (!hasRole("super_admin")) router.navigate({ to: "/dashboard" }); }, [hasRole, router]);

  const q = useQuery({ queryKey: ["externals"], queryFn: () => wdasConfig.listExternalApprovers() });

  return (
    <div>
      <PageHeader
        title="External Approvers"
        subtitle="Approvers outside the AD directory — email/OTP based access with expiring links."
        actions={<AddExternalDialog onAdded={() => qc.invalidateQueries({ queryKey: ["externals"] })} />}
      />
      <div className="p-6">
        <Card>
          <CardContent className="p-0">
            {q.isLoading ? <LoadingState />
              : q.isError ? <ErrorState message="Could not load external approvers." onRetry={() => q.refetch()} />
              : !q.data?.length ? <EmptyState icon={<Mail className="h-8 w-8" />} title="No external approvers yet" />
              : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Related Document</TableHead>
                      <TableHead>Link Sent</TableHead>
                      <TableHead>Link Expiry</TableHead>
                      <TableHead>OTP</TableHead>
                      <TableHead>IP</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {q.data.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium">{e.name}</TableCell>
                        <TableCell className="text-xs">{e.email}</TableCell>
                        <TableCell className="max-w-[240px] truncate text-xs">{e.documentSubject ?? "—"}</TableCell>
                        <TableCell className="text-xs">{relTime(e.linkSentAt)}</TableCell>
                        <TableCell className="text-xs">{relTime(e.linkExpiresAt)}</TableCell>
                        <TableCell><OtpBadge s={e.otpStatus} /></TableCell>
                        <TableCell className="font-mono text-xs">{e.ipAddress ?? "—"}</TableCell>
                        <TableCell>
                          {e.actionTaken === "approved" && <Badge className="border-success/30 bg-success/15 text-success" variant="outline">Approved</Badge>}
                          {e.actionTaken === "rejected" && <Badge className="border-destructive/30 bg-destructive/15 text-destructive" variant="outline">Rejected</Badge>}
                          {(!e.actionTaken || e.actionTaken === "pending") && <Badge variant="outline">Pending</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={async () => {
                            await wdasConfig.resendLink(e.id);
                            toast.success("Fresh link sent", { description: `${e.email} — link valid for 7 days.` });
                            qc.invalidateQueries({ queryKey: ["externals"] });
                          }}>
                            <RotateCw className="mr-1 h-3.5 w-3.5" /> Resend
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )
            }
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function OtpBadge({ s }: { s: OtpStatus }) {
  const map: Record<OtpStatus, string> = {
    verified: "border-success/30 bg-success/15 text-success",
    pending: "border-info/30 bg-info/15 text-info",
    expired: "border-destructive/30 bg-destructive/15 text-destructive",
  };
  return <Badge variant="outline" className={map[s]}>{s}</Badge>;
}

export function AddExternalDialog({ onAdded, trigger }: { onAdded?: () => void; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const emailError = useMemo(() => email.length > 0 && !emailRe.test(email) ? "Invalid email format" : "", [email]);
  const canSave = !!name.trim() && emailRe.test(email);

  const submit = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      await wdasConfig.addExternalApprover(name.trim(), email.trim().toLowerCase());
      toast.success("External approver added", { description: `Invitation link sent to ${email}` });
      onAdded?.();
      setOpen(false); setName(""); setEmail("");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
      <DialogTrigger asChild>
        {trigger ?? <Button><Plus className="mr-1 h-4 w-4" /> Add external approver</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add external approver</DialogTitle>
          <DialogDescription>An email invitation with a secure OTP-verified link (valid 7 days) will be sent.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Full name <span className="text-destructive">*</span></Label>
            <Input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} placeholder="e.g. Adnan Rashid" />
          </div>
          <div className="space-y-1.5">
            <Label>Email <span className="text-destructive">*</span></Label>
            <Input type="email" value={email} maxLength={255} onChange={(e) => setEmail(e.target.value)} placeholder="name@partner.com" />
            {emailError && <p className="text-xs text-destructive">{emailError}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={!canSave || busy}>{busy ? "Sending…" : "Send invitation"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
