import { useQuery } from "@tanstack/react-query";
import { getToken } from "@/lib/api/client";
import { wdas } from "@/services/wdas";
import { useSession } from "./role-context";
import { useAuthReady } from "./use-auth-ready";

export function useDocumentQuery(id: string) {
  const { isAuthed } = useSession();
  const authReady = useAuthReady();
  const canFetch = authReady && isAuthed && !!getToken();

  return useQuery({
    queryKey: ["doc", id],
    queryFn: () => wdas.getDocument(id),
    enabled: canFetch,
    staleTime: 0,
  });
}

export function useCanFetchDocuments(): boolean {
  const { isAuthed } = useSession();
  const authReady = useAuthReady();
  return authReady && isAuthed && !!getToken();
}
