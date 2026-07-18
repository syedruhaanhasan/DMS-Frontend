import { AlertCircle, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

export function LoadingState() {
  return (
    <div className="space-y-3 p-5" aria-label="Loading workspace data">
      <div className="h-4 w-32 animate-pulse rounded bg-muted" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-lg border border-border/60 p-3">
          <div className="h-9 w-9 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-2/5 animate-pulse rounded bg-muted" />
            <div className="h-2.5 w-1/4 animate-pulse rounded bg-muted/80" />
          </div>
          <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full border border-destructive/20 bg-destructive/10 p-3 text-destructive">
        <AlertCircle className="h-6 w-6" />
      </div>
      <p className="mt-3 max-w-sm text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 text-foreground">{icon ?? <Inbox className="h-8 w-8" />}</div>
      <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <div className="h-9 flex-1 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}
