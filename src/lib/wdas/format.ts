import { formatDistanceToNow, format } from "date-fns";

export const formatPKR = (n: number | undefined) =>
  n == null ? "—" : `PKR ${n.toLocaleString("en-PK")}`;

/**
 * API UTC fields often arrive without a trailing Z. Browsers then treat them as
 * local time (e.g. PKT shows ~5h early). Force UTC when no offset is present.
 */
export function parseApiDate(iso: string): Date {
  const s = iso.trim();
  if (!s) return new Date(NaN);
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) return new Date(s);
  if (s.includes("T")) return new Date(`${s}Z`);
  return new Date(s);
}

/** Normalize API UTC strings to ISO with Z for safe downstream Date parsing. */
export function toUtcIso(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  const d = parseApiDate(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

export const relTime = (iso: string) =>
  formatDistanceToNow(parseApiDate(iso), { addSuffix: true });

export const absTime = (iso: string) => format(parseApiDate(iso), "PPpp");
