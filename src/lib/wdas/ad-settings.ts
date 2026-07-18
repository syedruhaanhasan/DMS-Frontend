/**
 * Active Directory configuration is stored in the database and read via the API
 * (see wdasConfig.getActiveDirectorySettings / getActiveDirectoryStatus).
 * This module only keeps the helper for identifying AD-backed accounts.
 */

/** True when a user account is backed by Active Directory (has an AD object id). */
export function isAdAccount(adId?: string | null): boolean {
  return typeof adId === "string" && adId.trim().length > 0;
}
