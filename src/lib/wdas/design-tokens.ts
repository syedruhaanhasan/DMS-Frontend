/**
 * WDAS Design System Tokens
 * Enterprise document routing, review & approval platform.
 *
 * Principles: clarity over decoration, status-first, auditability visible,
 * WCAG 2.1 AA (color + icon + label, 4.5:1 contrast minimum).
 */

export const WDAS_COLORS = {
  /** Deep indigo — primary actions, links, focus rings */
  brand: {
    light: "oklch(0.31 0.085 255)",
    dark: "oklch(0.65 0.13 248)",
    label: "Brand / Primary",
  },
  /** Semantic status palette — always pair with icon + text label */
  status: {
    approved: { token: "success", label: "Approved / On-time", hex: "#16a34a" },
    pending: { token: "info", label: "Pending / In Progress", hex: "#2563eb" },
    atRisk: { token: "warning", label: "At-risk / SLA warning", hex: "#d97706" },
    rejected: { token: "destructive", label: "Rejected / Overdue", hex: "#dc2626" },
    draft: { token: "neutral", label: "Draft / Cancelled", hex: "#64748b" },
    returned: { token: "warning", label: "Returned for correction", hex: "#d97706" },
  },
  surface: {
    background: "oklch(0.985 0.006 250)",
    card: "oklch(0.995 0.003 250)",
    sidebar: "oklch(0.2 0.045 255)",
    border: "oklch(0.905 0.008 248)",
  },
} as const;

export const WDAS_TYPOGRAPHY = {
  fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif',
  scale: {
    display: { size: "1.75rem", lineHeight: "2.125rem", weight: 600, usage: "Page titles" },
    h1: { size: "1.25rem", lineHeight: "1.75rem", weight: 600, usage: "Document subject, section headers" },
    h2: { size: "1rem", lineHeight: "1.5rem", weight: 600, usage: "Card titles, panel headers" },
    body: { size: "0.875rem", lineHeight: "1.375rem", weight: 400, usage: "Document body, table cells" },
    bodyLg: { size: "1rem", lineHeight: "1.625rem", weight: 400, usage: "Rich-text editor content" },
    caption: { size: "0.75rem", lineHeight: "1rem", weight: 500, usage: "Timestamps, badges, metadata" },
    mono: { size: "0.8125rem", lineHeight: "1.25rem", weight: 400, usage: "Doc IDs, PKR amounts" },
  },
  weights: [400, 500, 600, 700] as const,
} as const;

export const WDAS_SPACING = {
  /** 4px base unit */
  unit: 4,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
  page: { x: 24, y: 24, maxWidth: "80rem" },
  sidebar: { expanded: 256, collapsed: 64 },
  header: 64,
} as const;

export const WDAS_RADIUS = {
  sm: "0.375rem",
  md: "0.5rem",
  lg: "0.75rem",
  xl: "1rem",
  full: "9999px",
} as const;

export const WDAS_ELEVATION = {
  /** Subtle 1px borders preferred over heavy shadows */
  border: "1px solid var(--border)",
  card: "0 1px 2px rgba(15, 23, 42, 0.05), 0 12px 28px -18px rgba(31, 56, 100, 0.16)",
  header: "0 1px 0 rgba(15, 23, 42, 0.06)",
} as const;

export type TableDensity = "comfortable" | "compact";

export const WDAS_DENSITY = {
  comfortable: { rowHeight: "3rem", cellPadding: "0.75rem 1rem", fontSize: "0.875rem" },
  compact: { rowHeight: "2.25rem", cellPadding: "0.375rem 0.75rem", fontSize: "0.8125rem" },
} as const;

/** PKR financial approval matrix tiers (Finance workflow) */
export const WDAS_APPROVAL_MATRIX = [
  { min: 0, max: 500_000, chain: ["Department Head"] },
  { min: 500_001, max: 2_000_000, chain: ["Department Head", "Finance Manager"] },
  { min: 2_000_001, max: 10_000_000, chain: ["Department Head", "Finance Manager", "Finance Director"] },
  { min: 10_000_001, max: null, chain: ["Department Head", "Finance Manager", "Finance Director", "CFO"] },
] as const;

export const WDAS_A11Y = {
  contrastMinimum: "4.5:1",
  focusRing: "2px solid brand at 60% opacity, 2px offset",
  statusRule: "Never use color alone — always icon + text label",
  keyboard: "Full tab order; sticky action bars reachable via keyboard",
  aria: {
    statusBadge: 'role="status"',
    workflowStepper: 'aria-label="Approval workflow progress"',
    confirmModal: 'role="alertdialog" aria-describedby="consequence-text"',
  },
} as const;
