type AuditChange = {
  field?: string;
  from?: string | null;
  to?: string | null;
  message?: string | null;
};

const SENSITIVE_KEY = /password|secret|token/i;

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY.test(key);
}

function formatChange(change: AuditChange): string {
  const label = change.field ?? "Field";
  if (change.message) {
    return `${label}: ${change.message}`;
  }
  if (change.from != null && change.to != null) {
    return `${label}: ${change.from} → ${change.to}`;
  }
  if (change.to != null) {
    return `${label}: ${change.to}`;
  }
  if (change.from != null) {
    return `${label}: ${change.from}`;
  }
  return label;
}

function formatLegacyEntry(key: string, value: unknown): string | null {
  if (isSensitiveKey(key)) {
    return `${key}: Password updated`;
  }
  if (value == null || value === "") {
    return null;
  }
  if (typeof value === "object") {
    return `${key}: ${JSON.stringify(value)}`;
  }
  return `${key}: ${String(value)}`;
}

export function formatAuditDetails(detailsJson: string | null | undefined): string {
  if (!detailsJson?.trim()) {
    return "—";
  }

  try {
    const data = JSON.parse(detailsJson) as Record<string, unknown>;
    const changes = data.changes;
    if (Array.isArray(changes) && changes.length > 0) {
      return changes
        .map((item) => formatChange(item as AuditChange))
        .filter(Boolean)
        .join("; ");
    }

    const parts = Object.entries(data)
      .filter(([key]) => key !== "changes")
      .map(([key, value]) => formatLegacyEntry(key, value))
      .filter((part): part is string => Boolean(part));

    return parts.length ? parts.join("; ") : "—";
  } catch {
    return detailsJson;
  }
}

export function auditDetailsSearchText(detailsJson: string | null | undefined): string {
  const formatted = formatAuditDetails(detailsJson);
  return formatted === "—" ? "" : formatted;
}
