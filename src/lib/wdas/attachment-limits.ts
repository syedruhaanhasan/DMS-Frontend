/** Max size for a single document attachment (must match Attachments:MaxFileSizeBytes). */
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

export function formatAttachmentSizeLimit(): string {
  return "5 MB";
}

/** Returns an error message if the file exceeds the limit; otherwise null. */
export function attachmentSizeError(file: { name: string; size: number }): string | null {
  if (file.size <= 0) return `"${file.name}" is empty.`;
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return `"${file.name}" exceeds the ${formatAttachmentSizeLimit()} limit.`;
  }
  return null;
}
