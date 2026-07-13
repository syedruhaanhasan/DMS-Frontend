import { useState, type ReactNode } from "react";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Inbox, FileText, FilePlus, FolderSearch,
  BarChart3, Search, ChevronLeft, ChevronRight, LogOut, Settings,
  Workflow as WorkflowIcon, GitBranch, Mail, UserPlus, ChevronDown, UserCog, Building2, Network, FileType,
  Sun, Moon, Sparkles, Plus, Command, BriefcaseBusiness,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession, ROLE_LABEL, isSuperAdmin, canAccessNavItem } from "@/lib/wdas/role-context";
import { useLanguage } from "@/lib/wdas/language-context";
import { useTheme } from "@/lib/wdas/theme-context";
import { t, type I18nKey } from "@/lib/wdas/i18n";
import type { Role } from "@/lib/wdas/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
  DropdownMenuRadioGroup, DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { NotificationBell } from "./notification-bell";

interface NavItem { to: string; labelKey: I18nKey; icon: typeof LayoutDashboard; roles: Role[]; disabled?: boolean; }
interface NavGroup { labelKey: I18nKey; items: NavItem[]; roles: Role[]; }

const MAIN_NAV: NavItem[] = [
  { to: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard, roles: ["super_admin", "dept_admin", "owner", "approver", "auditor"] },
  { to: "/dashboard/department", labelKey: "deptDashboard", icon: Building2, roles: ["dept_admin"] },
  { to: "/inbox", labelKey: "inbox", icon: Inbox, roles: ["dept_admin", "approver"] },
  { to: "/documents/new", labelKey: "newDocument", icon: FilePlus, roles: ["owner"] },
  { to: "/documents", labelKey: "myDocuments", icon: FileText, roles: ["owner"] },
  { to: "/repository", labelKey: "repository", icon: FolderSearch, roles: ["dept_admin", "owner", "approver", "auditor"] },
  { to: "/reports", labelKey: "reports", icon: BarChart3, roles: ["dept_admin", "auditor"] },
];

const CONFIG_GROUP: NavGroup = {
  labelKey: "configuration",
  roles: ["super_admin"],
  items: [
    { to: "/config/departments", labelKey: "departments", icon: Building2, roles: ["super_admin"] },
    { to: "/config/users", labelKey: "users", icon: UserPlus, roles: ["super_admin"] },
    { to: "/config/active-directory", labelKey: "activeDirectory", icon: Network, roles: ["super_admin"] },
    { to: "/config/workflows", labelKey: "workflows", icon: WorkflowIcon, roles: ["super_admin"] },
    { to: "/config/document-types", labelKey: "documentTypes", icon: FileType, roles: ["super_admin"] },
    { to: "/config/approval-modes", labelKey: "approvalModes", icon: GitBranch, roles: ["super_admin"] },
    { to: "/config/external-approvers", labelKey: "externalApprovers", icon: Mail, roles: ["super_admin"] },
    { to: "/settings/delegation", labelKey: "delegation", icon: UserPlus, roles: ["super_admin"] },
  ],
};

const SETTINGS_GROUP: NavGroup = {
  labelKey: "settings",
  roles: ["owner", "approver", "auditor"],
  items: [
    { to: "/settings", labelKey: "account", icon: Settings, roles: ["owner", "approver", "auditor", "dept_admin"] },
    { to: "/settings/delegation", labelKey: "delegation", icon: UserPlus, roles: ["approver"] },
  ],
};

function NavLinkItem({ item, collapsed, active, lang }: { item: NavItem; collapsed: boolean; active: boolean; lang: ReturnType<typeof useLanguage>["lang"] }) {
  const Icon = item.icon;
  const label = t(item.labelKey, lang);
  if (item.disabled) {
    return (
      <div className={cn("relative flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/40", collapsed && "justify-center px-2")} title={label}>
        <Icon className="h-[18px] w-[18px] shrink-0" />
        {!collapsed && <><span className="flex-1">{label}</span><Badge variant="outline" className="border-sidebar-border text-[10px] text-sidebar-foreground/50">Soon</Badge></>}
      </div>
    );
  }
  return (
    <Link
      to={item.to}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-[inset_0_0_0_1px_color-mix(in_oklab,white_10%,transparent)]"
          : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
        collapsed && "justify-center px-2",
      )}
      title={label}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-sidebar-primary" aria-hidden />
      )}
      <Icon className={cn("h-[18px] w-[18px] shrink-0 transition-colors", active ? "text-sidebar-primary" : "text-sidebar-foreground/60 group-hover:text-sidebar-foreground")} />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const { role, user, setRole, signOut, availableRoles } = useSession();
  const { lang } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [configOpen, setConfigOpen] = useState(
    pathname.startsWith("/config") || pathname.startsWith("/settings/delegation") || role === "super_admin",
  );
  const [activeWorkspace, setActiveWorkspace] = useState("Corporate HQ");

  const initials = user.name.split(" ").map((n) => n[0]).slice(0, 2).join("");
  const isActive = (to: string) => pathname === to || (to !== "/dashboard" && pathname.startsWith(to));
  const superAdminView = isSuperAdmin(role);
  const workspaceOptions = ["Corporate HQ", "Operations", "Finance", "Legal Review"];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <aside
        className={cn(
          "sidebar-gradient relative flex flex-col border-r border-sidebar-border/60 text-sidebar-foreground shadow-[1px_0_0_0_color-mix(in_oklab,black_8%,transparent)] transition-[width] duration-300 ease-out",
          collapsed ? "w-20" : "w-[280px]",
        )}
      >
        <div className={cn("flex items-center gap-2.5 border-b border-sidebar-border/60 px-4 py-4", collapsed && "justify-center px-2")}>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/12 shadow-[0_8px_20px_-12px_rgba(0,0,0,0.35)] ring-1 ring-white/10">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-sidebar-primary to-brand text-sm font-semibold text-sidebar-primary-foreground">W</div>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight">WDAS</p>
              <p className="truncate text-[11px] text-sidebar-foreground/60">{t("documentApprovals", lang)}</p>
            </div>
          )}
        </div>

        <div className={cn("px-3 py-3", collapsed && "px-2")}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "flex w-full items-center gap-2 rounded-2xl border border-white/10 bg-white/6 px-3 py-2.5 text-left transition-all duration-150 hover:bg-white/10",
                  collapsed && "justify-center px-2",
                )}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-400/15 text-cyan-100">
                  <BriefcaseBusiness className="h-4 w-4" />
                </div>
                {!collapsed && (
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/55">Workspace</p>
                    <p className="truncate text-sm font-medium text-sidebar-foreground">{activeWorkspace}</p>
                  </div>
                )}
                {!collapsed && <ChevronDown className="h-3.5 w-3.5 text-sidebar-foreground/60" />}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60">
              <DropdownMenuLabel>Switch workspace</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {workspaceOptions.map((workspace) => (
                <DropdownMenuItem key={workspace} onClick={() => setActiveWorkspace(workspace)}>
                  {workspace}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-1">
          {!collapsed && (
            <p className="px-3 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/45">{t("workspace", lang)}</p>
          )}
          {MAIN_NAV.filter((n) => canAccessNavItem(n.roles, availableRoles)).map((item) => (
            <NavLinkItem key={item.to} item={item} collapsed={collapsed} active={isActive(item.to)} lang={lang} />
          ))}

          {canAccessNavItem(CONFIG_GROUP.roles, availableRoles) && (
            <div className="pt-3">
              {!collapsed ? (
                <button
                  type="button"
                  onClick={() => setConfigOpen((v) => !v)}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/45 transition-colors hover:text-sidebar-foreground/80"
                >
                  <UserCog className="h-3.5 w-3.5" />
                  <span className="flex-1 text-left">{t(CONFIG_GROUP.labelKey, lang)}</span>
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-150", !configOpen && "-rotate-90")} />
                </button>
              ) : (
                <div className="my-2 border-t border-sidebar-border/50" />
              )}
              {(configOpen || collapsed) && (
                <div className="mt-1 space-y-0.5">
                  {CONFIG_GROUP.items.filter((n) => canAccessNavItem(n.roles, availableRoles)).map((item) => (
                    <NavLinkItem key={item.to} item={item} collapsed={collapsed} active={isActive(item.to)} lang={lang} />
                  ))}
                </div>
              )}
            </div>
          )}

          {canAccessNavItem(SETTINGS_GROUP.roles, availableRoles) && (
            <div className="pt-3">
              {!collapsed && (
                <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/45">{t(SETTINGS_GROUP.labelKey, lang)}</p>
              )}
              {SETTINGS_GROUP.items.filter((n) => canAccessNavItem(n.roles, availableRoles)).map((item) => (
                <NavLinkItem key={item.to} item={item} collapsed={collapsed} active={isActive(item.to)} lang={lang} />
              ))}
            </div>
          )}
        </nav>

        {!collapsed && (
          <div className="mx-3 mb-3 rounded-2xl border border-white/10 bg-white/6 p-3">
            <div className="mb-2 flex items-center gap-2 text-white/80">
              <Sparkles className="h-4 w-4 text-cyan-200" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">Quick actions</span>
            </div>
            <div className="grid gap-2">
              <Link to="/documents/new" className="flex items-center justify-between rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-white/10 hover:text-sidebar-foreground">
                <span className="flex items-center gap-2">
                  <Plus className="h-4 w-4 text-cyan-100" />
                  New document
                </span>
                <ChevronRight className="h-4 w-4 text-sidebar-foreground/55" />
              </Link>
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-sidebar-accent/35 px-3 py-2 text-sm text-sidebar-foreground/80">
                <span className="flex items-center gap-2">
                  <Command className="h-4 w-4 text-violet-100" />
                  Search workflows
                </span>
                <kbd className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-sidebar-foreground/65">⌘K</kbd>
              </div>
            </div>
          </div>
        )}

        <div className={cn("mt-auto border-t border-sidebar-border/60 p-3", collapsed && "px-2")}>
          <div className={cn("flex items-center gap-3 rounded-2xl border border-white/10 bg-white/6 px-3 py-2.5", collapsed && "justify-center px-2")}>
            <Avatar className="h-9 w-9 ring-1 ring-white/10">
              <AvatarFallback className="bg-gradient-to-br from-primary to-brand text-xs font-semibold text-primary-foreground">{initials}</AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-sidebar-foreground">{user.name}</p>
                <p className="truncate text-[11px] text-sidebar-foreground/60">{user.department}</p>
              </div>
            )}
          </div>

          <button
            onClick={() => setCollapsed((v) => !v)}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-sidebar-border/60 py-2.5 text-xs font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="h-4 w-4" /> Collapse</>}
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/70 bg-card/80 px-5 shadow-[0_1px_0_rgba(15,23,42,0.04),0_10px_24px_-16px_rgba(31,56,100,0.16)] backdrop-blur-xl supports-[backdrop-filter]:bg-card/70">
          {!superAdminView && (
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search documents, subjects, IDs…"
                className="h-10 rounded-xl border-border/70 bg-muted/50 pl-9 text-sm shadow-none focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-ring/40"
              />
              <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 select-none items-center gap-1 rounded border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-flex">⌘K</kbd>
            </div>
          )}

          <div className="flex-1" />

          <Button asChild variant="default" size="sm" className="hidden h-9 gap-2 rounded-full bg-gradient-to-r from-primary via-indigo-500 to-cyan-500 text-white shadow-[0_10px_30px_-18px_rgba(37,99,235,0.8)] md:inline-flex">
            <Link to="/documents/new">
              <Plus className="h-4 w-4" />
              Quick create
            </Link>
          </Button>

          {availableRoles.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-2 rounded-full border-border/70 bg-card/70 shadow-none hover:bg-muted">
                  <span className="hidden text-muted-foreground sm:inline">View as</span>
                  <span className="font-medium">{ROLE_LABEL[role]}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Active role view</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={role} onValueChange={(v) => setRole(v as Role)}>
                  {availableRoles.map((r) => (
                    <DropdownMenuRadioItem key={r} value={r}>{ROLE_LABEL[r]}</DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {availableRoles.length > 1 && <div className="h-6 w-px bg-border/70" />}

          <Button
            variant="outline"
            size="icon"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            title={theme === "dark" ? "Light mode" : "Dark mode"}
            className="h-9 w-9 rounded-full border-border/70 bg-card/70 shadow-none hover:bg-muted"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {!superAdminView && <NotificationBell />}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2.5 rounded-lg px-1.5 py-1 transition-colors hover:bg-muted">
                <Avatar className="h-8 w-8 ring-1 ring-border">
                  <AvatarFallback className="bg-gradient-to-br from-primary to-brand text-xs font-semibold text-primary-foreground">{initials}</AvatarFallback>
                </Avatar>
                <div className="hidden text-left sm:block">
                  <p className="text-xs font-semibold leading-tight">{user.name}</p>
                  <p className="text-[11px] leading-tight text-muted-foreground">{user.department}</p>
                </div>
                <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>
                <p className="font-medium">{user.name}</p>
                <p className="text-xs font-normal text-muted-foreground">{user.designation} · {user.department}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { signOut(); router.navigate({ to: "/login" }); }}>
                <LogOut className="mr-2 h-4 w-4" /> {t("signOut", lang)}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
