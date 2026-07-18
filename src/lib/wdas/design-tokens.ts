/**
 * WDAS Design System Tokens — Amber & Onyx
 * Enterprise document routing, review & approval platform.
 *
 * Principles: clarity over decoration, status-first, auditability visible,
 * WCAG 2.1 AA (color + icon + label, 4.5:1 contrast minimum).
 * Yellow is an accent (~10% surface), never large fills; yellow text never on white.
 */

export const WDAS_COLORS = {
  /** Amber — CTAs, active states, key highlights only; black text on yellow */
  brand: {
    light: "#FFC400",
    hover: "#E6B000",
    dark: "#FFC400",
    foreground: "#111114",
    label: "Brand / Primary",
  },
  chrome: {
    dark: "#0D0D0F",
    surface: "#16161A",
    canvas: "#FAFAF7",
    inverse: "#F5F5F2",
  },
  /** Semantic status palette — always pair with icon + text label */
  status: {
    approved: { token: "success", label: "Approved / On-time", hex: "#2E9E5B" },
    pending: { token: "pending", label: "Pending / In Progress", hex: "#8A8A92" },
    atRisk: { token: "warning", label: "At-risk / SLA warning", hex: "#E8A317" },
    rejected: { token: "destructive", label: "Rejected / Overdue", hex: "#D64545" },
    draft: { token: "neutral", label: "Draft / Cancelled", hex: "#6B6B70" },
    returned: { token: "warning", label: "Returned for correction", hex: "#E8A317" },
    info: { token: "info", label: "Informational", hex: "#3B7DD8" },
  },
  surface: {
    background: "#FAFAF7",
    card: "#FFFFFF",
    sidebar: "#0D0D0F",
    border: "#E4E4E0",
    text: "#111114",
    muted: "#6B6B70",
  },
} as const;

export const WDAS_TYPOGRAPHY = {
  fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif',
  scale: {
    display: { size: "1.75rem", lineHeight: "2.125rem", weight: 600, usage: "Page titles (24–28px)" },
    h1: { size: "1.25rem", lineHeight: "1.75rem", weight: 600, usage: "Document subject, section headers" },
    h2: { size: "1rem", lineHeight: "1.5rem", weight: 600, usage: "Card titles, panel headers" },
    body: { size: "0.875rem", lineHeight: "1.375rem", weight: 400, usage: "Document body, table cells (14px base)" },
    bodyLg: { size: "1rem", lineHeight: "1.625rem", weight: 400, usage: "Rich-text editor content" },
    caption: { size: "0.75rem", lineHeight: "1rem", weight: 500, usage: "Timestamps, badges, metadata" },
    mono: { size: "0.8125rem", lineHeight: "1.25rem", weight: 400, usage: "Doc IDs, amounts — tabular numerals" },
  },
  weights: [400, 500, 600, 700] as const,
} as const;

export const WDAS_SPACING = {
  /** 8px spacing grid (4px micro unit) */
  unit: 4,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
  page: { x: 24, y: 24, maxWidth: "100rem" },
  sidebar: { expanded: 260, collapsed: 72 },
  header: 64,
  transition: "150ms ease",
} as const;

export const WDAS_RADIUS = {
  sm: "0.375rem",
  md: "0.5rem",
  lg: "0.75rem", // 12px card radius
  xl: "1rem",
  full: "9999px",
} as const;

export const WDAS_ELEVATION = {
  /** Subtle 1px borders preferred over heavy shadows */
  border: "1px solid var(--border)",
  card: "0 1px 2px rgba(13, 13, 15, 0.04)",
  header: "0 1px 0 rgba(255, 255, 255, 0.06)",
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
  focusRing: "2px solid amber at 60% opacity, 2px offset",
  statusRule: "Never use color alone — always icon + text label",
  yellowRule: "Never place yellow text on white; yellow buttons use black (#111114) text",
  keyboard: "Full tab order; sticky action bars reachable via keyboard",
  aria: {
    statusBadge: 'role="status"',
    workflowStepper: 'aria-label="Approval workflow progress"',
    confirmModal: 'role="alertdialog" aria-describedby="consequence-text"',
  },
} as const;
