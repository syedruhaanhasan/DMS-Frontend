import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useSession } from "@/lib/wdas/role-context";
import { wdasConfig } from "@/services/wdas-config";
import { useUsers } from "@/lib/wdas/users-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { UserCheck } from "lucide-react";
import { absTime } from "@/lib/wdas/format";

/** Shows an in-page banner when the current user has an active outgoing OR incoming delegation. */
export function DelegationBanner() {
  const { user } = useSession();
  const { getUser } = useUsers();
  const q = useQuery({ queryKey: ["delegations"], queryFn: () => wdasConfig.listDelegations() });
  const list = q.data ?? [];
  const now = Date.now();
  const outgoing = list.find(
    (d) => d.fromUserId === user.id && d.active && new Date(d.startAt).getTime() <= now && new Date(d.endAt).getTime() >= now,
  );
  const incoming = list.find(
    (d) => d.toUserId === user.id && d.active && new Date(d.startAt).getTime() <= now && new Date(d.endAt).getTime() >= now,
  );
  const fromName = incoming ? getUser(incoming.fromUserId)?.name : undefined;
  const toName = outgoing ? getUser(outgoing.toUserId)?.name : undefined;
  if (!outgoing && !incoming) return null;
  return (
    <Alert className="mx-6 mt-4 border-info/40 bg-info/10">
      <UserCheck className="h-4 w-4" />
      <AlertTitle>Delegation active</AlertTitle>
      <AlertDescription className="space-y-1 text-sm">
        {outgoing && (
          <p>Your incoming approvals are being routed to <b>{toName}</b> until {absTime(outgoing.endAt)}. <Link to="/settings/delegation" className="text-primary underline">Manage</Link></p>
        )}
        {incoming && (
          <p>You are receiving approvals delegated from <b>{fromName}</b> until {absTime(incoming.endAt)}.</p>
        )}
      </AlertDescription>
    </Alert>
  );
}
