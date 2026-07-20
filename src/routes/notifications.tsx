import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/wdas/page-header";
import { useSession } from "@/lib/wdas/role-context";
import { useUserNotifications, markAllRead, markRead, type NotificationType } from "@/lib/wdas/notifications-store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, FileText, Clock, XCircle, RotateCcw, Ban, CheckCircle2, AlertTriangle, Search, Eye } from "lucide-react";
import { EmptyState } from "@/components/wdas/data-states";
import { cn } from "@/lib/utils";
import { relTime, absTime } from "@/lib/wdas/format";

export const Route = createFileRoute("/notifications")({
  component: NotificationsPage,
});

const ICONS: Record<NotificationType, { icon: typeof Bell; color: string; label: string }> = {
  new_request: { icon: FileText, color: "text-info", label: "New request" },
  sla_reminder: { icon: Clock, color: "text-warning", label: "SLA reminder" },
  escalation: { icon: AlertTriangle, color: "text-destructive", label: "Escalation" },
  rejected: { icon: XCircle, color: "text-destructive", label: "Rejected" },
  returned: { icon: RotateCcw, color: "text-warning", label: "Returned" },
  cancelled: { icon: Ban, color: "text-muted-foreground", label: "Cancelled" },
  finalized: { icon: CheckCircle2, color: "text-success", label: "Finalized" },
  approval_recorded: { icon: CheckCircle2, color: "text-success", label: "Approval update" },
  reviewer_added: { icon: Eye, color: "text-info", label: "Added as reviewer" },
  system: { icon: Bell, color: "text-muted-foreground", label: "System" },
};

function NotificationsPage() {
  const { user, role } = useSession();
  const list = useUserNotifications(user.id);
  const [type, setType] = useState<NotificationType | "all">("all");
  const [read, setRead] = useState<"all" | "unread" | "read">("all");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    return list.filter((n) => {
      if (type !== "all" && n.type !== type) return false;
      if (read === "unread" && n.read) return false;
      if (read === "read" && !n.read) return false;
      if (q && !(n.title + " " + n.description).toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [list, type, read, q]);

  const unread = list.filter((n) => !n.read).length;

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle={`${unread} unread of ${list.length} total`}
        actions={<Button variant="outline" onClick={() => markAllRead(user.id)} disabled={unread === 0}>Mark all as read</Button>}
      />
      <div className="space-y-4 p-6">
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <div className="relative min-w-[240px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search notifications…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
            </div>
            <Select value={type} onValueChange={(v) => setType(v as NotificationType | "all")}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All event types</SelectItem>
                {(Object.keys(ICONS) as NotificationType[]).map((t) => (
                  <SelectItem key={t} value={t}>{ICONS[t].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={read} onValueChange={(v) => setRead(v as typeof read)}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="unread">Unread</SelectItem>
                <SelectItem value="read">Read</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {!filtered.length ? (
              <EmptyState icon={<Bell className="h-8 w-8" />} title="No notifications match your filters" />
            ) : (
              <ul className="divide-y">
                {filtered.map((n) => {
                  const { icon: Icon, color, label } = ICONS[n.type] ?? ICONS.system;
                  const to = n.type === "reviewer_added" || (role === "approver" && n.type === "new_request")
                    ? "/documents/$id/review"
                    : "/documents/$id";
                  return (
                    <li key={n.id}>
                      <Link
                        to={to}
                        params={{ id: n.docId }}
                        onClick={() => markRead(user.id, n.id)}
                        className={cn(
                          "flex gap-4 p-4 transition-colors hover:bg-muted/50",
                          !n.read && "bg-info/5",
                        )}
                      >
                        <div className={cn("mt-1 shrink-0", color)}><Icon className="h-5 w-5" /></div>
                        <div className="flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className={cn("text-sm", !n.read && "font-semibold")}>{n.title}</p>
                            <Badge variant="outline" className="text-[10px]">{label}</Badge>
                            {!n.read && <span className="h-2 w-2 rounded-full bg-info" aria-label="Unread" />}
                          </div>
                          <p className="text-sm text-muted-foreground">{n.description}</p>
                          <p className="text-xs text-muted-foreground" title={absTime(n.createdAt)}>{relTime(n.createdAt)}</p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
