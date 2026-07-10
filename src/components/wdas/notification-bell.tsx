import { Link } from "@tanstack/react-router";
import { useSession } from "@/lib/wdas/role-context";
import { useUserNotifications, markAllRead, markRead, type NotificationType } from "@/lib/wdas/notifications-store";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell, FileText, Clock, XCircle, RotateCcw, Ban, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { relTime } from "@/lib/wdas/format";
import { ScrollArea } from "@/components/ui/scroll-area";

const ICONS: Record<NotificationType, { icon: typeof Bell; color: string }> = {
  new_request: { icon: FileText, color: "text-info" },
  sla_reminder: { icon: Clock, color: "text-warning" },
  escalation: { icon: AlertTriangle, color: "text-destructive" },
  rejected: { icon: XCircle, color: "text-destructive" },
  returned: { icon: RotateCcw, color: "text-warning" },
  cancelled: { icon: Ban, color: "text-muted-foreground" },
  finalized: { icon: CheckCircle2, color: "text-success" },
};

export function NotificationBell() {
  const { user, role } = useSession();
  const list = useUserNotifications(user.id);
  const unread = list.filter((n) => !n.read).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative min-h-11 min-w-11 rounded-full border border-border/70 bg-card/70 shadow-sm" aria-label={`Notifications (${unread} unread)`}>
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span
              aria-hidden="true"
              className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground"
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Notifications</p>
            <p className="text-xs text-muted-foreground">{unread} unread</p>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => void markAllRead(user.id)} disabled={unread === 0}>Mark all read</Button>
          </div>
        </div>
        <ScrollArea className="h-[380px]">
          {list.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No notifications yet.</div>
          ) : (
            list.map((n) => {
              const { icon: Icon, color } = ICONS[n.type];
              const to = role === "approver" && n.type === "new_request" ? "/documents/$id/review" : "/documents/$id";
              return (
                <Link
                  key={n.id}
                  to={to}
                  params={{ id: n.docId }}
                  onClick={() => void markRead(user.id, n.id)}
                  className={cn(
                    "flex gap-3 border-b px-4 py-3 text-left transition-colors last:border-0 hover:bg-muted/60",
                    !n.read && "bg-info/5",
                  )}
                >
                  <div className={cn("mt-0.5 shrink-0", color)}><Icon className="h-4 w-4" /></div>
                  <div className="flex-1 space-y-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn("text-sm", !n.read && "font-semibold")}>{n.title}</p>
                      {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-info" aria-label="Unread" />}
                    </div>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{n.description}</p>
                    <p className="text-[11px] text-muted-foreground">{relTime(n.createdAt)}</p>
                  </div>
                </Link>
              );
            })
          )}
        </ScrollArea>
        <div className="border-t p-2">
          <Button asChild variant="ghost" size="sm" className="w-full justify-center">
            <Link to="/notifications">View all notifications</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
