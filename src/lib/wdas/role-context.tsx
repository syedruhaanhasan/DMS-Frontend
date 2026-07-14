import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, setToken, setUnauthorizedHandler } from "@/lib/api/client";
import type { ApiLoginResponse, ApiUserSummaryDto } from "@/lib/api/types";
import { mapUser, pickPrimaryRole, mapApiRole } from "@/lib/api/mappers";
import type { Role, User, Department } from "./types";
import { ROUTE_PERMISSIONS, expandImpliedPermissions } from "./permissions";

interface Session {
  role: Role;
  userId: string;
  isAuthed: boolean;
  viewDept?: Department | "all";
  userProfile?: User;
  availableRoles: Role[];
  permissions: string[];
}

interface Ctx extends Session {
  user: User;
  setRole: (r: Role) => void;
  setViewDept: (d: Department | "all") => void;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => void;
  scopeDept: Department | "all";
  hasRole: (r: Role) => boolean;
  hasAnyRole: (roles: Role[]) => boolean;
  /** True if the user has this permission (or any of the listed permissions). */
  can: (permission: string | string[]) => boolean;
}

const RoleCtx = createContext<Ctx | null>(null);

const GUEST_USER: User = {
  id: "",
  name: "Guest",
  designation: "",
  department: "Finance",
  email: "",
};

function rolesFromApi(dto: ApiUserSummaryDto): Role[] {
  return [...new Set((dto.roles ?? []).map((r) => mapApiRole(r as never)))];
}

function emptySession(): Session {
  return { role: "owner", userId: "", isAuthed: false, viewDept: "all", availableRoles: [], permissions: [] };
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>(emptySession);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken(null);
      try {
        localStorage.removeItem("wdas.session");
      } catch {
        /* ignore */
      }
      setSession(emptySession());
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("wdas.session");
      const token = localStorage.getItem("wdas.token");
      if (raw) {
        const parsed = JSON.parse(raw) as Session;
        if (parsed.isAuthed && !token) {
          setSession(emptySession());
          return;
        }
        setSession((cur) =>
          cur.isAuthed === parsed.isAuthed && cur.userId === parsed.userId
            ? cur
            : { ...emptySession(), viewDept: "all", ...parsed, permissions: parsed.permissions ?? [] },
        );
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("wdas.session", JSON.stringify(session));
    } catch {
      /* ignore */
    }
  }, [session]);

  const user = session.userProfile ?? GUEST_USER;

  const scopeDept: Department | "all" =
    session.role === "super_admin"
      ? (session.viewDept ?? "all")
      : session.role === "dept_admin"
        ? user.department
        : user.department;

  const can = (permission: string | string[]) => {
    const perms = expandImpliedPermissions(session.permissions ?? []);
    if (session.availableRoles.includes("super_admin")) return true;
    const need = Array.isArray(permission) ? permission : [permission];
    return need.some((p) => perms.includes(p));
  };

  const value: Ctx = {
    ...session,
    user,
    scopeDept,
    hasRole: (r) => session.availableRoles.includes(r),
    hasAnyRole: (roles) => roles.some((r) => session.availableRoles.includes(r)),
    can,
    setRole: (r) => {
      if (session.availableRoles.length && !session.availableRoles.includes(r)) return;
      setSession((s) => ({ ...s, role: r }));
    },
    setViewDept: (d) => setSession((s) => ({ ...s, viewDept: d })),
    signIn: async (username, password) => {
      const res = await api.post<ApiLoginResponse>("/api/auth/login", { username, password });
      setToken(res.accessToken);
      const profile = mapUser(res.user);
      const availableRoles = rolesFromApi(res.user);
      const role = pickPrimaryRole(res.user.roles as never);
      setSession({
        role,
        userId: profile.id,
        isAuthed: true,
        viewDept: "all",
        userProfile: profile,
        availableRoles,
        permissions: expandImpliedPermissions(res.user.permissions ?? profile.permissions ?? []),
      });
    },
    signOut: () => {
      setToken(null);
      try {
        localStorage.removeItem("wdas.session");
      } catch {
        /* ignore */
      }
      setSession(emptySession());
    },
  };

  return <RoleCtx.Provider value={value}>{children}</RoleCtx.Provider>;
}

export function useSession() {
  const ctx = useContext(RoleCtx);
  if (!ctx) throw new Error("useSession outside RoleProvider");
  return ctx;
}

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Super Admin",
  dept_admin: "Department Admin",
  owner: "Document Owner",
  approver: "Approver (Internal)",
  auditor: "Auditor",
};

export function isSuperAdmin(role: Role) {
  return role === "super_admin";
}

export function isPathAllowedForSuperAdmin(pathname: string): boolean {
  if (pathname === "/dashboard") return true;
  if (pathname.startsWith("/config")) return true;
  if (pathname.startsWith("/settings/delegation")) return true;
  return false;
}

export function isAdminRole(role: Role) {
  return role === "super_admin" || role === "dept_admin";
}

export function canAccessNavItem(itemRoles: Role[], availableRoles: Role[]): boolean {
  return itemRoles.some((r) => availableRoles.includes(r));
}

export function requiredPermissionForPath(pathname: string): string | null {
  for (const entry of ROUTE_PERMISSIONS) {
    if (pathname === entry.prefix || pathname.startsWith(entry.prefix + "/")) {
      return entry.permission;
    }
  }
  return null;
}
