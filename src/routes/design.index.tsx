import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  WDAS_COLORS, WDAS_TYPOGRAPHY, WDAS_SPACING, WDAS_RADIUS, WDAS_DENSITY, WDAS_A11Y, WDAS_APPROVAL_MATRIX,
} from "@/lib/wdas/design-tokens";
import {
  FIXTURE_DOCUMENT, FIXTURE_DASHBOARD_ROWS, FIXTURE_COMMENTS, FIXTURE_STEPS,
  FIXTURE_ATTACHMENTS, FIXTURE_MATRIX_BANDS, FIXTURE_REPORTS, FIXTURE_USERS, FIXTURE_DOC_ID,
} from "@/lib/wdas/design-fixtures";
import { StatusBadge, SlaBadge, PriorityBadge } from "@/components/wdas/badges";
import { WorkflowStepper } from "@/components/wdas/workflow-stepper";
import { CommentThread } from "@/components/wdas/comment-thread";
import { DocumentCard } from "@/components/wdas/document-card";
import { AttachmentPreviewGrid } from "@/components/wdas/attachment-preview-tile";
import { ConfirmDialog } from "@/components/wdas/confirm-dialog";
import { ChainPreview } from "@/components/wdas/stepper";
import { formatPKR } from "@/lib/wdas/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Building2, ShieldCheck, Inbox, FileText, CheckCircle2, AlertTriangle,
  Search, BarChart3, Bell, Lock, Eye, Bold, Italic, List, Table as TableIcon,
  UploadCloud, Check, X, RotateCcw, Network, Workflow,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

export const Route = createFileRoute("/design/")({
  component: DesignShowcase,
});

type Section =
  | "tokens" | "components" | "login" | "dashboard" | "composer"
  | "approval" | "workflow" | "repository" | "reports" | "external";

const NAV: { id: Section; label: string }[] = [
  { id: "tokens", label: "Design System" },
  { id: "components", label: "Components" },
  { id: "login", label: "Login / SSO" },
  { id: "dashboard", label: "Dashboard" },
  { id: "composer", label: "Document Creation" },
  { id: "approval", label: "Approval View" },
  { id: "workflow", label: "Workflow Builder" },
  { id: "repository", label: "Repository" },
  { id: "reports", label: "Reporting" },
  { id: "external", label: "External Approver" },
];

function A11yNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-info/25 bg-info/5 px-4 py-3 text-sm text-foreground/90">
      <p className="font-medium text-info">Accessibility</p>
      <p className="mt-1 text-muted-foreground">{children}</p>
    </div>
  );
}

function ScreenFrame({ title, children, a11y }: { title: string; children: React.ReactNode; a11y?: string }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">High-fidelity mock with workflow-accurate sample data</p>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">{children}</div>
      {a11y && <A11yNote>{a11y}</A11yNote>}
    </section>
  );
}

function DesignShowcase() {
  const [section, setSection] = useState<Section>("tokens");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");

  const resolveUser = (id: string) => {
    const u = Object.values(FIXTURE_USERS).find((x) => x.id === id);
    return u ? { id: u.id, name: u.name, designation: u.designation } : undefined;
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-56 shrink-0 border-r border-border bg-sidebar text-sidebar-foreground">
        <div className="border-b border-sidebar-border px-4 py-4">
          <p className="text-sm font-semibold">WDAS Design System</p>
          <p className="text-[11px] text-sidebar-foreground/60">v1.0 · Enterprise UI</p>
        </div>
        <nav className="space-y-0.5 p-2">
          {NAV.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setSection(n.id)}
              className={cn(
                "w-full rounded-lg px-3 py-2 text-left text-sm transition-colors",
                section === n.id
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50",
              )}
            >
              {n.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-10 border-b border-border bg-card/90 px-6 py-4 backdrop-blur">
          <h1 className="text-xl font-semibold">WDAS UI Specification</h1>
          <p className="text-sm text-muted-foreground">
            Document Routing, Review &amp; Approval Platform — corporate, audit-ready, status-first
          </p>
        </header>

        <div className="mx-auto max-w-5xl space-y-8 p-6">
          {section === "tokens" && (
            <div className="space-y-8">
              <section>
                <h2 className="text-lg font-semibold">Color Palette</h2>
                <p className="mt-1 text-sm text-muted-foreground">Neutral base + semantic status colors. Never color-only.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(WDAS_COLORS.status).map(([key, v]) => (
                    <div key={key} className="flex items-center gap-3 rounded-lg border p-3">
                      <div className="h-10 w-10 rounded-md border" style={{ background: v.hex }} />
                      <div>
                        <p className="text-sm font-medium">{v.label}</p>
                        <p className="text-xs text-muted-foreground">token: {v.token}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h2 className="text-lg font-semibold">Typography Scale</h2>
                <p className="mt-1 text-sm text-muted-foreground">{WDAS_TYPOGRAPHY.fontFamily}</p>
                <div className="mt-4 space-y-3 rounded-lg border p-4">
                  {Object.entries(WDAS_TYPOGRAPHY.scale).map(([key, t]) => (
                    <div key={key} className="flex items-baseline justify-between border-b border-border/50 pb-2 last:border-0">
                      <span style={{ fontSize: t.size, lineHeight: t.lineHeight, fontWeight: t.weight }}>{key}</span>
                      <span className="text-xs text-muted-foreground">{t.size} / {t.usage}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h2 className="text-lg font-semibold">Spacing &amp; Density</h2>
                <p className="mt-1 text-sm text-muted-foreground">Base unit: {WDAS_SPACING.unit}px · Radius: {WDAS_RADIUS.lg}</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {(["comfortable", "compact"] as const).map((d) => (
                    <div key={d} className="rounded-lg border p-3">
                      <p className="text-sm font-medium capitalize">{d}</p>
                      <p className="text-xs text-muted-foreground">
                        Row {WDAS_DENSITY[d].rowHeight} · Padding {WDAS_DENSITY[d].cellPadding}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h2 className="text-lg font-semibold">PKR Approval Matrix</h2>
                <table className="mt-4 w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-4">Amount band</th>
                      <th className="pb-2">Approver chain</th>
                    </tr>
                  </thead>
                  <tbody>
                    {WDAS_APPROVAL_MATRIX.map((b, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-2 pr-4 font-mono text-xs">
                          {formatPKR(b.min)} – {b.max ? formatPKR(b.max) : "and above"}
                        </td>
                        <td className="py-2">{b.chain.join(" → ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              <A11yNote>
                {WDAS_A11Y.contrastMinimum} contrast minimum. Status uses icon + label ({WDAS_A11Y.statusRule}).
                Focus: {WDAS_A11Y.focusRing}.
              </A11yNote>
            </div>
          )}

          {section === "components" && (
            <div className="space-y-8">
              <section>
                <h2 className="text-lg font-semibold">Status Badges</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(["draft", "pending", "approved", "rejected", "returned", "cancelled"] as const).map((s) => (
                    <StatusBadge key={s} status={s} />
                  ))}
                  <SlaBadge sla="on_time" />
                  <SlaBadge sla="at_risk" />
                  <SlaBadge sla="overdue" />
                  <PriorityBadge priority="Urgent" />
                  <PriorityBadge priority="Critical" />
                </div>
              </section>

              <section>
                <h2 className="text-lg font-semibold">Workflow Stepper</h2>
                <div className="mt-3 rounded-lg border p-4">
                  <WorkflowStepper steps={FIXTURE_STEPS} currentStepId="s2" resolveUser={resolveUser} />
                </div>
              </section>

              <section>
                <h2 className="text-lg font-semibold">Comment Thread</h2>
                <div className="mt-3 rounded-lg border p-4">
                  <CommentThread comments={FIXTURE_COMMENTS} />
                </div>
              </section>

              <section>
                <h2 className="text-lg font-semibold">Document Card</h2>
                <div className="mt-3 max-w-md">
                  <DocumentCard doc={{ ...FIXTURE_DOCUMENT, currentStep: "Finance Manager" }} showActions />
                </div>
              </section>

              <section>
                <h2 className="text-lg font-semibold">Attachment Preview Tile</h2>
                <div className="mt-3 max-w-lg">
                  <AttachmentPreviewGrid attachments={FIXTURE_ATTACHMENTS} />
                </div>
              </section>

              <section>
                <h2 className="text-lg font-semibold">Confirmation Modal</h2>
                <Button variant="destructive" onClick={() => setConfirmOpen(true)}>Preview Reject modal</Button>
                <ConfirmDialog
                  open={confirmOpen}
                  onOpenChange={setConfirmOpen}
                  title="Reject this document?"
                  description={
                    <p>
                      Rejecting will stop this workflow and return the document to{" "}
                      <strong>{FIXTURE_USERS.owner.name}</strong>. This cannot be undone.
                    </p>
                  }
                  confirmLabel="Reject"
                  variant="destructive"
                  requireReason
                  onConfirm={() => setConfirmOpen(false)}
                />
              </section>
            </div>
          )}

          {section === "login" && (
            <ScreenFrame
              title="A. Login / SSO"
              a11y="Form fields have associated labels; error alerts use role=alert. SSO button is keyboard-focusable with visible focus ring."
            >
              <div className="flex min-h-[480px]">
                <div className="hidden w-2/5 flex-col justify-between bg-sidebar p-8 text-sidebar-foreground md:flex">
                  <div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sidebar-primary text-lg font-bold text-sidebar-primary-foreground">W</div>
                    <h2 className="mt-6 text-2xl font-semibold">WDAS</h2>
                    <p className="mt-2 text-sm text-sidebar-foreground/70">
                      Secure document routing integrated with Active Directory. Every approval is traceable.
                    </p>
                  </div>
                  <p className="text-xs text-sidebar-foreground/50">© 2026 Enterprise Corp · SOC 2 compliant</p>
                </div>
                <div className="flex flex-1 flex-col justify-center p-8">
                  <div className="mx-auto w-full max-w-sm">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <ShieldCheck className="h-4 w-4 text-success" />
                      Sign in with your corporate account
                    </div>
                    <div className="mt-6 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="design-user">Username / Email</Label>
                        <Input id="design-user" defaultValue="sara.ahmed@corp.local" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="design-pass">Password</Label>
                        <Input id="design-pass" type="password" defaultValue="••••••••" />
                      </div>
                    </div>
                    <Button className="mt-6 w-full" size="lg">
                      <Network className="mr-2 h-4 w-4" /> Sign in with Active Directory
                    </Button>
                    <p className="mt-4 text-center text-xs text-muted-foreground">
                      <a href="#" className="text-primary hover:underline">Trouble signing in?</a> Contact IT Service Desk
                    </p>
                  </div>
                </div>
              </div>
            </ScreenFrame>
          )}

          {section === "dashboard" && (
            <ScreenFrame
              title="B. Personal Dashboard"
              a11y="KPI cards use semantic headings. Table is sortable with aria-sort. Status badges include icon + text. Density toggle updates row height."
            >
              <div className="p-4">
                <div className="mb-4 flex items-center justify-between">
                  <p className="font-semibold">Welcome back, Sara</p>
                  <div className="flex gap-1 rounded-lg border p-0.5">
                    {(["comfortable", "compact"] as const).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDensity(d)}
                        className={cn(
                          "rounded-md px-2 py-1 text-xs capitalize",
                          density === d ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                        )}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mb-4 grid gap-3 sm:grid-cols-4">
                  {[
                    { label: "Pending My Approval", value: 4, icon: Inbox, color: "text-info" },
                    { label: "My Documents", value: 7, icon: FileText, color: "text-primary" },
                    { label: "Recently Completed", value: 12, icon: CheckCircle2, color: "text-success" },
                    { label: "SLA Breaches", value: 1, icon: AlertTriangle, color: "text-destructive" },
                  ].map((k) => {
                    const Icon = k.icon;
                    return (
                      <div key={k.label} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">{k.label}</p>
                          <Icon className={cn("h-4 w-4", k.color)} />
                        </div>
                        <p className="mt-1 text-2xl font-semibold">{k.value}</p>
                      </div>
                    );
                  })}
                </div>
                <div className="overflow-x-auto rounded-lg border">
                  <table className={cn("w-full text-sm", density === "compact" && "text-xs")}>
                    <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="p-2">Doc ID</th>
                        <th className="p-2">Subject</th>
                        <th className="p-2">Workflow</th>
                        <th className="p-2 text-right">Amount</th>
                        <th className="p-2">Step</th>
                        <th className="p-2">Status</th>
                        <th className="p-2">SLA</th>
                        <th className="p-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {FIXTURE_DASHBOARD_ROWS.map((r) => (
                        <tr key={r.refId} className="border-b border-border/50 hover:bg-accent/30">
                          <td className="p-2 font-mono text-xs">{r.refId}</td>
                          <td className="max-w-[200px] truncate p-2 font-medium">{r.subject}</td>
                          <td className="p-2 text-xs text-muted-foreground">{r.workflow}</td>
                          <td className="p-2 text-right font-mono">{formatPKR(r.amount)}</td>
                          <td className="p-2 text-xs">{r.currentStep}</td>
                          <td className="p-2"><StatusBadge status={r.status} /></td>
                          <td className="p-2"><SlaBadge sla={r.sla} /></td>
                          <td className="p-2">
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost"><Eye className="h-3.5 w-3.5" /></Button>
                              <Button size="sm" variant="ghost" className="text-success"><Check className="h-3.5 w-3.5" /></Button>
                              <Button size="sm" variant="ghost" className="text-destructive"><X className="h-3.5 w-3.5" /></Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </ScreenFrame>
          )}

          {section === "composer" && (
            <ScreenFrame
              title="C. Document Creation"
              a11y="Rich-text toolbar buttons have aria-labels. Attachment zone supports keyboard drop target. Sticky footer actions remain focusable."
            >
              <div className="flex flex-col">
                <div className="space-y-4 border-b p-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label>To</Label>
                      <Input placeholder="Search AD users, departments…" defaultValue="Finance Approvers" />
                    </div>
                    <div className="space-y-1">
                      <Label>From</Label>
                      <Input disabled defaultValue={`${FIXTURE_USERS.owner.name} · Procurement`} />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label>Subject</Label>
                      <Input defaultValue={FIXTURE_DOCUMENT.subject} />
                    </div>
                    <div className="space-y-1">
                      <Label>Workflow</Label>
                      <Input defaultValue="Financial — Capital Expenditure" />
                    </div>
                    <div className="space-y-1">
                      <Label>Amount (PKR)</Label>
                      <Input defaultValue="4,750,000" className="font-mono" />
                    </div>
                  </div>
                  <div className="rounded-lg border border-info/25 bg-info/5 p-3 text-xs">
                    <p className="font-medium text-info">Resolved approval chain (PKR 4,750,000)</p>
                    <p className="mt-1 text-muted-foreground">
                      Department Head → Finance Manager → Finance Director → CFO
                    </p>
                  </div>
                </div>
                <div className="border-b p-2">
                  <div className="flex flex-wrap gap-1">
                    {[Bold, Italic, List, TableIcon].map((Icon, i) => (
                      <Button key={i} variant="ghost" size="sm" className="h-8 w-8 p-0"><Icon className="h-4 w-4" /></Button>
                    ))}
                  </div>
                </div>
                <div className="min-h-[120px] p-4 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: FIXTURE_DOCUMENT.body }} />
                <div className="border-t p-4">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Attachments</p>
                  <AttachmentPreviewGrid attachments={FIXTURE_ATTACHMENTS} />
                  <div className="mt-2 flex items-center justify-center rounded-lg border border-dashed py-6 text-sm text-muted-foreground">
                    <UploadCloud className="mr-2 h-4 w-4" /> Drag files here or click to upload
                  </div>
                </div>
                <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-card p-4">
                  <Button variant="outline">Save as Draft</Button>
                  <Button variant="outline"><Eye className="mr-1 h-4 w-4" /> Preview</Button>
                  <Button>Submit for Approval</Button>
                </div>
              </div>
            </ScreenFrame>
          )}

          {section === "approval" && (
            <ScreenFrame
              title="D. Approval / Document View"
              a11y="Workflow stepper has aria-label. Action buttons open alertdialog with mandatory comment for reject/return. High-value docs may require re-auth step."
            >
              <div>
                <div className="border-b p-4">
                  <p className="text-xs text-muted-foreground">{FIXTURE_DOC_ID}</p>
                  <h3 className="text-lg font-semibold">{FIXTURE_DOCUMENT.subject}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    From {FIXTURE_USERS.owner.name} · {formatPKR(FIXTURE_DOCUMENT.amount)} · Procurement
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <PriorityBadge priority="Urgent" />
                    <StatusBadge status="pending" />
                    <SlaBadge sla="at_risk" />
                  </div>
                  <div className="mt-4 rounded-lg border bg-muted/20 p-3">
                    <WorkflowStepper steps={FIXTURE_STEPS} currentStepId="s2" resolveUser={resolveUser} />
                  </div>
                </div>
                <div className="grid lg:grid-cols-3">
                  <div className="space-y-4 border-r p-4 lg:col-span-2">
                    <div className="prose prose-sm max-w-none rounded-lg border bg-muted/20 p-4" dangerouslySetInnerHTML={{ __html: FIXTURE_DOCUMENT.body }} />
                    <AttachmentPreviewGrid attachments={FIXTURE_ATTACHMENTS} />
                    <CommentThread comments={FIXTURE_COMMENTS} />
                  </div>
                  <div className="p-4">
                    <p className="text-sm font-semibold">Your action</p>
                    <Textarea className="mt-2" rows={3} placeholder="Comment (required for Reject / Return)…" />
                    <div className="mt-3 space-y-2">
                      <Button className="w-full bg-success text-success-foreground"><Check className="mr-2 h-4 w-4" /> Approve</Button>
                      <Button className="w-full bg-warning text-warning-foreground"><RotateCcw className="mr-2 h-4 w-4" /> Return for Correction</Button>
                      <Button variant="destructive" className="w-full"><X className="mr-2 h-4 w-4" /> Reject</Button>
                    </div>
                  </div>
                </div>
              </div>
            </ScreenFrame>
          )}

          {section === "workflow" && (
            <ScreenFrame
              title="E. Workflow Builder &amp; Approval Matrix"
              a11y="Matrix tiers use table semantics. Add/remove controls are labeled. Version badge announces draft vs published state."
            >
              <div className="grid lg:grid-cols-2">
                <div className="space-y-4 border-r p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">Financial — Capital Expenditure</p>
                    <Badge variant="outline" className="text-success">Published v3</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">12 in-flight documents on version 2</p>
                  <div className="space-y-2">
                    <Label>Approval mode</Label>
                    <Input defaultValue="Amount Matrix (sequential)" disabled />
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="pb-2">Tier</th>
                        <th className="pb-2">Amount band (PKR)</th>
                        <th className="pb-2">Approver groups</th>
                      </tr>
                    </thead>
                    <tbody>
                      {FIXTURE_MATRIX_BANDS.map((b) => (
                        <tr key={b.tier} className="border-b border-border/50">
                          <td className="py-2 font-medium">{b.tier}</td>
                          <td className="py-2 font-mono text-xs">{b.range}</td>
                          <td className="py-2 text-xs">{b.groups.join(" → ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="p-4">
                  <p className="mb-2 text-sm font-semibold">Live preview — amount PKR 4,750,000</p>
                  <ChainPreview
                    nodes={[
                      { label: "Department Head", sub: "Imran Malik · Procurement" },
                      { label: "Finance Manager", sub: "Sara Ahmed · Any 1" },
                      { label: "Finance Director", sub: "Hassan Raza" },
                      { label: "CFO", sub: "Fatima Noor" },
                    ]}
                  />
                  <div className="mt-4 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    <Workflow className="mx-auto mb-2 h-8 w-8 opacity-40" />
                    Drag approver groups to reorder steps
                  </div>
                </div>
              </div>
            </ScreenFrame>
          )}

          {section === "repository" && (
            <ScreenFrame
              title="F. Repository / Search"
              a11y="Faceted filters use fieldset/legend. Audit trail table has column headers scoped to rows. Locked document state announced to screen readers."
            >
              <div className="flex">
                <aside className="w-48 shrink-0 border-r p-3 text-sm">
                  <p className="mb-2 font-semibold">Filters</p>
                  {["Status", "Department", "Date range", "Amount", "Approver"].map((f) => (
                    <div key={f} className="mb-2">
                      <p className="text-xs text-muted-foreground">{f}</p>
                      <Input className="mt-1 h-8 text-xs" placeholder="Any" />
                    </div>
                  ))}
                </aside>
                <div className="flex-1 p-4">
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input className="pl-9" placeholder="Search by Doc ID, subject, owner…" defaultValue="ERP Server" />
                  </div>
                  <div className="rounded-lg border">
                    <div className="flex items-center gap-2 border-b p-3">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-semibold">{FIXTURE_DOCUMENT.subject}</p>
                        <p className="text-xs text-muted-foreground">{FIXTURE_DOC_ID} · Approved · Finalized 8 Jul 2026</p>
                      </div>
                    </div>
                    <table className="w-full text-xs">
                      <thead className="border-b bg-muted/30 text-muted-foreground">
                        <tr>
                          <th className="p-2 text-left">Approver</th>
                          <th className="p-2 text-left">Action</th>
                          <th className="p-2 text-left">Comment</th>
                          <th className="p-2 text-left">Timestamp</th>
                          <th className="p-2 text-left">IP</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b">
                          <td className="p-2">Imran Malik</td>
                          <td className="p-2"><StatusBadge status="approved" /></td>
                          <td className="p-2">Budget line verified</td>
                          <td className="p-2">7 Jul 2026, 10:22</td>
                          <td className="p-2 font-mono">10.0.4.22</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </ScreenFrame>
          )}

          {section === "reports" && (
            <ScreenFrame
              title="G. Reporting &amp; Analytics"
              a11y="Charts include text alternatives via data table fallback. Export buttons are secondary to visual insight per layout hierarchy."
            >
              <div className="p-4">
                <div className="mb-4 flex justify-end gap-2">
                  <Button variant="outline" size="sm"><BarChart3 className="mr-1 h-4 w-4" /> Export Excel</Button>
                  <Button variant="outline" size="sm">Export PDF</Button>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-lg border p-3">
                    <p className="mb-2 text-sm font-semibold">Avg approval cycle time by department (days)</p>
                    <div className="h-[180px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={FIXTURE_REPORTS.cycleTimeByDept}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="dept" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} label={{ value: "Days", angle: -90, position: "insideLeft", fontSize: 11 }} />
                          <Tooltip />
                          <Bar dataKey="days" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="mb-2 text-sm font-semibold">Volume trends (submitted vs approved)</p>
                    <div className="h-[180px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={FIXTURE_REPORTS.volumeTrend}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Line type="monotone" dataKey="submitted" stroke="var(--info)" strokeWidth={2} name="Submitted" />
                          <Line type="monotone" dataKey="approved" stroke="var(--success)" strokeWidth={2} name="Approved" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Bottleneck: {FIXTURE_REPORTS.bottleneck} · Rejection rate: {FIXTURE_REPORTS.rejectionRate}%
                </p>
              </div>
            </ScreenFrame>
          )}

          {section === "external" && (
            <ScreenFrame
              title="H. External Approver View"
              a11y="Single-purpose page without main nav. OTP gate precedes document view. Security messaging visible above fold."
            >
              <div className="bg-muted/30 p-8">
                <div className="mx-auto max-w-lg">
                  <div className="mb-6 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                      <Building2 className="h-6 w-6" />
                    </div>
                    <h3 className="mt-3 text-lg font-semibold">Secure Document Approval</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      This is a secure, single-use link. Your session expires after one action.
                    </p>
                  </div>
                  <div className="rounded-xl border bg-card p-6">
                    <div className="flex items-center gap-2 text-xs text-success">
                      <ShieldCheck className="h-4 w-4" /> Identity verified via one-time code
                    </div>
                    <h4 className="mt-4 font-semibold">{FIXTURE_DOCUMENT.subject}</h4>
                    <p className="mt-1 text-sm text-muted-foreground">
                      From {FIXTURE_USERS.owner.name} · {formatPKR(FIXTURE_DOCUMENT.amount)}
                    </p>
                    <div className="mt-4 rounded-lg border bg-muted/20 p-3 text-sm" dangerouslySetInnerHTML={{ __html: FIXTURE_DOCUMENT.body.slice(0, 200) + "…" }} />
                    <Textarea className="mt-4" rows={2} placeholder="Your comment…" />
                    <div className="mt-4 flex gap-2">
                      <Button className="flex-1 bg-success text-success-foreground">Approve</Button>
                      <Button variant="destructive" className="flex-1">Reject</Button>
                    </div>
                  </div>
                </div>
              </div>
            </ScreenFrame>
          )}
        </div>
      </main>
    </div>
  );
}
