import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/wdas/page-header";
import { useSession } from "@/lib/wdas/role-context";
import { wdasConfig } from "@/services/wdas-config";
import { useUsers } from "@/lib/wdas/users-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserCheck, Info } from "lucide-react";
import { toast } from "sonner";
import { absTime, relTime } from "@/lib/wdas/format";

export const Route = createFileRoute("/settings/delegation")({
  component: DelegationPage,
});

function toDateInput(iso: string) {
  return iso.slice(0, 10);
}

function DelegationPage() {
  const { user } = useSession();
  const qc = useQueryClient();
  const [start, setStart] = useState(() => toDateInput(new Date().toISOString()));
  const [end, setEnd] = useState(() => toDateInput(new Date(Date.now() + 7 * 86400000).toISOString()));
  const [delegateId, setDelegateId] = useState<string>("");
  const [active, setActive] = useState(true);
  const [autoReply, setAutoReply] = useState("");

  const list = useQuery({ queryKey: ["delegations"], queryFn: () => wdasConfig.listDelegations() });

  const mine = list.data?.find((d) => d.fromUserId === user.id);
  useEffect(() => {
    if (mine) {
      setStart(toDateInput(mine.startAt));
      setEnd(toDateInput(mine.endAt));
      setDelegateId(mine.toUserId);
      setActive(mine.active);
    }
  }, [mine]);

  const { users } = useUsers();
  const candidates = users.filter((u) => u.id !== user.id && u.status !== "disabled");

  const save = async () => {
    if (!delegateId) { toast.error("Choose a delegate"); return; }
    if (new Date(end) < new Date(start)) { toast.error("End date must be after start"); return; }
    await wdasConfig.upsertDelegation(user.id, delegateId, new Date(start).toISOString(), new Date(end).toISOString(), active, autoReply.trim() || undefined);
    toast.success("Delegation saved", { description: active ? "Delegate will receive your incoming approvals during the window." : "Delegation created but currently inactive." });
    qc.invalidateQueries({ queryKey: ["delegations"] });
  };

  const off = async () => {
    if (!mine?.id) return;
    await wdasConfig.deactivateDelegation(mine.id);
    toast.success("Delegation turned off");
    qc.invalidateQueries({ queryKey: ["delegations"] });
    setActive(false);
  };

  return (
    <div>
      <PageHeader
        title="Delegation"
        subtitle="Route your incoming approvals to another user for a date range."
      />
      <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><UserCheck className="h-4 w-4 text-info" /> Your delegation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {mine?.active && (
              <Alert className="border-info/40 bg-info/10">
                <Info className="h-4 w-4" />
                <AlertTitle>Active delegation</AlertTitle>
                <AlertDescription>
                  Your incoming approvals are going to <b>{users.find((u) => u.id === mine.toUserId)?.name}</b> until {absTime(mine.endAt)}.
                </AlertDescription>
              </Alert>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Start date</Label>
                <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>End date</Label>
                <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Delegate</Label>
              <Select value={delegateId} onValueChange={setDelegateId}>
                <SelectTrigger><SelectValue placeholder="Pick a delegate from the directory" /></SelectTrigger>
                <SelectContent>
                  {candidates.map((u) => <SelectItem key={u.id} value={u.id}>{u.name} — {u.designation} · {u.department}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Out-of-office auto-reply (optional)</Label>
              <Input value={autoReply} onChange={(e) => setAutoReply(e.target.value)} placeholder="I am away until…" />
            </div>
            <div className="flex items-center gap-3">
              <Switch id="act" checked={active} onCheckedChange={setActive} />
              <Label htmlFor="act">Delegation active</Label>
            </div>
            <div className="flex gap-2">
              <Button onClick={save}>Save delegation</Button>
              {mine?.active && <Button variant="outline" onClick={off}>Turn off</Button>}
            </div>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Actions taken by your delegate will show in the document trail as "Approved by [Delegate] on behalf of {user.name}".
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Company delegations</CardTitle></CardHeader>
          <CardContent className="p-0">
            {(list.data ?? []).length === 0 && <p className="p-4 text-sm text-muted-foreground">No delegations set up.</p>}
            {(list.data ?? []).map((d) => {
              const from = users.find((u) => u.id === d.fromUserId);
              const to = users.find((u) => u.id === d.toUserId);
              return (
                <div key={d.id} className="border-b px-4 py-3 text-xs last:border-0">
                  <p className="text-sm font-medium">{from?.name} → {to?.name}</p>
                  <p className="text-muted-foreground">{relTime(d.startAt)} to {relTime(d.endAt)} · {d.active ? "Active" : "Inactive"}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
