export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="relative border-b border-border bg-muted/40 px-6 py-6 dark:bg-background sm:px-8">
      <div className="relative z-10 mx-auto flex max-w-[1600px] flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 h-1 w-8 rounded-full bg-primary" />
          <h1 className="truncate text-2xl font-semibold tracking-[-0.025em] text-foreground sm:text-[28px]">{title}</h1>
          {subtitle && <p className="mt-1 text-sm leading-6 text-muted-foreground">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}
