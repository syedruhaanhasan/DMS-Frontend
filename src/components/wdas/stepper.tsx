import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface Props {
  steps: string[];
  current: number; // 0-based
  onStepClick?: (i: number) => void;
  className?: string;
}

export function Stepper({ steps, current, onStepClick, className }: Props) {
  return (
    <ol className={cn("flex w-full items-center gap-2 overflow-x-auto", className)}>
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s} className="flex flex-1 items-center gap-2">
            <button
              type="button"
              onClick={() => onStepClick?.(i)}
              disabled={!onStepClick}
              className={cn(
                "flex items-center gap-2 whitespace-nowrap rounded-full border border-border/70 bg-card/80 px-3 py-2 text-xs shadow-sm transition-colors",
                onStepClick && "cursor-pointer hover:bg-accent",
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold",
                  done && "border-success bg-success text-success-foreground",
                  active && "border-info bg-info/15 text-info",
                  !done && !active && "border-border bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className={cn("font-medium", active ? "text-foreground" : "text-muted-foreground")}>{s}</span>
            </button>
            {i < steps.length - 1 && <span className={cn("h-px flex-1", i < current ? "bg-success/50" : "bg-border")} />}
          </li>
        );
      })}
    </ol>
  );
}

/** Horizontal read-only preview stepper for showing a resolved chain. */
export function ChainPreview({ nodes, className }: { nodes: { label: string; sub?: string }[]; className?: string }) {
  if (!nodes.length) {
    return (
      <div className={cn("rounded-md border border-dashed bg-muted/30 p-4 text-center text-xs text-muted-foreground", className)}>
        No approvers resolved yet — configure the mode below.
      </div>
    );
  }
  return (
    <div className={cn("flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 p-3", className)}>
      {nodes.map((n, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="min-w-[140px] rounded-md border bg-card px-3 py-2">
            <p className="text-xs font-semibold">{n.label}</p>
            {n.sub && <p className="text-[11px] text-muted-foreground">{n.sub}</p>}
          </div>
          {i < nodes.length - 1 && <span className="text-muted-foreground">→</span>}
        </div>
      ))}
    </div>
  );
}
