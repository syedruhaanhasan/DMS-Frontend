export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden border-b border-border/70 bg-[linear-gradient(135deg,rgba(37,99,235,0.1),rgba(6,182,212,0.06),rgba(255,255,255,0.92))] px-6 py-6 shadow-[inset_0_-1px_0_rgba(15,23,42,0.03)] sm:px-8">
      <div className="absolute -right-10 top-0 h-40 w-40 rounded-full bg-cyan-400/15 blur-3xl" />
      <div className="absolute left-0 top-1/2 h-24 w-24 -translate-y-1/2 rounded-full bg-indigo-400/10 blur-2xl" />

      <div className="relative z-10 mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            Workspace summary
          </span>
          <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm leading-6 text-muted-foreground">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}
