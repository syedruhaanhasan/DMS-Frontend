import type { QueryClient } from "@tanstack/react-query";
import type { Document } from "./types";

/** Keep document detail + inbox/dashboard lists in sync after workflow actions. */
export async function refreshWorkflowViews(
  qc: QueryClient,
  options: { userId: string; document?: Document },
) {
  const { userId, document } = options;

  if (document) {
    qc.setQueryData(["doc", document.id], document);
  }

  await Promise.all([
    qc.invalidateQueries({ queryKey: ["docs"], refetchType: "active" }),
    qc.invalidateQueries({ queryKey: ["dashboard", "me", userId], refetchType: "active" }),
    document
      ? qc.invalidateQueries({ queryKey: ["doc", document.id], refetchType: "active" })
      : Promise.resolve(),
  ]);
}
