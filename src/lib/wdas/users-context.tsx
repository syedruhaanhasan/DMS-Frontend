import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { getToken } from "@/lib/api/client";
import { wdasConfig } from "@/services/wdas-config";
import type { User } from "./types";

interface UsersCtx {
  users: User[];
  isLoading: boolean;
  getUser: (id: string) => User | undefined;
}

const Ctx = createContext<UsersCtx | null>(null);

export function UsersProvider({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) {
  const q = useQuery({
    queryKey: ["users", "directory"],
    queryFn: () => wdasConfig.listUsers(),
    enabled: enabled && !!getToken(),
    staleTime: 60_000,
  });

  const users = q.data ?? [];
  const value: UsersCtx = {
    users,
    isLoading: q.isLoading,
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
