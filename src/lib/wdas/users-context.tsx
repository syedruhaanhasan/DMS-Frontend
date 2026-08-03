import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { getToken } from "@/lib/api/client";
import { wdasConfig } from "@/services/wdas-config";
import { useSession } from "./role-context";
import type { User } from "./types";

interface UsersCtx {
  users: User[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  getUser: (id: string) => User | undefined;
}

const Ctx = createContext<UsersCtx | null>(null);

export function UsersProvider({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) {
  const { isAuthed } = useSession();
  const q = useQuery({
    queryKey: ["users", "directory"],
    queryFn: () => wdasConfig.listReviewers({ excludeSelf: false }).catch(() => wdasConfig.listUsers({ isActive: true })),
    enabled: enabled && isAuthed && !!getToken(),
    staleTime: 5 * 60_000,
    retry: 1,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const users = q.data ?? [];
  const value: UsersCtx = {
    users,
    isLoading: q.isLoading || (q.isFetching && !q.data),
    isError: q.isError,
    refetch: () => { void q.refetch(); },
    getUser: (id) => users.find((u) => u.id === id),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUsers() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useUsers outside UsersProvider");
  return ctx;
}

export function useUserById(id: string | undefined) {
  const { getUser } = useUsers();
  return id ? getUser(id) : undefined;
}
