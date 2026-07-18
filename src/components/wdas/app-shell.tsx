import { useState, type ReactNode } from "react";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Inbox, FileText, FilePlus, FolderSearch,
  BarChart3, Search, ChevronLeft, ChevronRight, LogOut, Settings,
  Workflow as WorkflowIcon, GitBranch, Mail, UserPlus, ChevronDown, UserCog, Building2, Network, FileType,
  Sun, Moon, Plus, Shield, ScrollText, IdCard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession, ROLE_LABEL, isSuperAdmin } from "@/lib/wdas/role-context";
import { useLanguage } from "@/lib/wdas/language-context";
import { useTheme } from "@/lib/wdas/theme-context";
import { t, type I18nKey } from "@/lib/wdas/i18n";
import { P } from "@/lib/wdas/permissions";
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

interface NavItem { to: string; labelKey: I18nKey; icon: typeof LayoutDashboard; permission: string; disabled?: boolean; }
interface NavGroup { labelKey: I18nKey; permission: string; items: NavItem[]; }

const MAIN_NAV: NavItem[] = [
  { to: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard, permission: P.nav.dashboard },
  { to: "/inbox", labelKey: "inbox", icon: Inbox, permission: P.nav.inbox },
  { to: "/documents/new", labelKey: "newDocument", icon: FilePlus, permission: P.nav.documentsNew },
  { to: "/documents", labelKey: "myDocuments", icon: FileText, permission: P.nav.documents },
  { to: "/repository", labelKey: "repository", icon: FolderSearch, permission: P.nav.repository },
  { to: "/reports", labelKey: "reports", icon: BarChart3, permission: P.nav.reports },
  { to: "/audit-log", labelKey: "auditLog", icon: ScrollText, permission: P.actions.reportsView },
];

const CONFIG_GROUP: NavGroup = {
  labelKey: "configuration",
  permission: P.nav.config,
  items: [
    { to: "/config/departments", labelKey: "departments", icon: Building2, permission: P.config.departments },
    { to: "/config/users", labelKey: "users", icon: UserPlus, permission: P.config.users },
    { to: "/config/user-types", labelKey: "userTypes", icon: IdCard, permission: P.config.users },
    { to: "/config/roles", labelKey: "roles", icon: Shield, permission: P.config.roles },
    { to: "/config/active-directory", labelKey: "activeDirectory", icon: Network, permission: P.config.ad },
    { to: "/config/workflows", labelKey: "workflows", icon: WorkflowIcon, permission: P.config.workflows },
    { to: "/config/document-types", labelKey: "documentTypes", icon: FileType, permission: P.config.documentTypes },
    { to: "/config/approval-modes", labelKey: "approvalModes", icon: GitBranch, permission: P.config.approvalModes },
    { to: "/config/external-approvers", labelKey: "externalApprovers", icon: Mail, permission: P.config.externalApprovers },
    { to: "/settings/delegation", labelKey: "delegation", icon: UserPlus, permission: P.config.delegation },
  ],
};

const SETTINGS_GROUP: NavGroup = {
  labelKey: "settings",
  permission: P.nav.settings,
  items: [
    { to: "/settings", labelKey: "account", icon: Settings, permission: P.nav.settings },
    { to: "/settings/delegation", labelKey: "delegation", icon: UserPlus, permission: P.actions.delegationManage },
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
        "group relative flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
        collapsed && "justify-center px-2",
      )}
      title={label}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-sidebar-primary" aria-hidden />
      )}
      <Icon className={cn("h-[18px] w-[18px] shrink-0 transition-colors", active ? "text-sidebar-primary" : "text-sidebar-foreground/60 group-hover:text-sidebar-foreground")} />
      {!collapsed && <span className="truncate">{label === "Inbox" ? "Approval Box" : label}</span>}
      {!collapsed && item.to === "/inbox" && (
        <span className="ml-auto min-w-5 rounded-full bg-primary px-1.5 py-0.5 text-center text-[10px] font-bold tabular-nums text-primary-foreground">7</span>
      )}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const { role, user, setRole, signOut, availableRoles, can } = useSession();
  const { lang } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [configOpen, setConfigOpen] = useState(
    pathname.startsWith("/config") || pathname.startsWith("/settings/delegation") || role === "super_admin",
  );

  const initials = user.name.split(" ").map((n) => n[0]).slice(0, 2).join("");
  const isActive = (to: string) => pathname === to || (to !== "/dashboard" && pathname.startsWith(to));
  const superAdminView = isSuperAdmin(role);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <aside
        className={cn(
          "sidebar-gradient relative flex flex-col border-r border-sidebar-border/60 text-sidebar-foreground shadow-[1px_0_0_0_color-mix(in_oklab,black_8%,transparent)] transition-[width] duration-300 ease-out",
          "hidden md:flex",
          collapsed ? "w-[72px]" : "w-[260px]",
        )}
      >
        <div className={cn("flex h-16 items-center gap-2.5 border-b border-sidebar-border/60 px-4", collapsed && "justify-center px-2")}>
          <img
            src="/veriflow-logo.jpg"
            alt="VeriFlow"
            className="h-9 w-9 shrink-0 rounded-xl bg-white object-contain p-0.5"
          />
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-[0.08em]">VeriFlow</p>
              <p className="truncate text-[10px] uppercase tracking-[0.14em] text-sidebar-foreground/45">Document control</p>
            </div>
          )}
        </div>

        <nav className="sidebar-scroll flex-1 space-y-0.5 overflow-y-auto px-2 py-5">
          {!collapsed && (
            <p className="px-3 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/45">{t("workspace", lang)}</p>
          )}
          {MAIN_NAV.filter((n) => can(n.permission)).map((item) => (
            <NavLinkItem key={item.to} item={item} collapsed={collapsed} active={isActive(item.to)} lang={lang} />
          ))}

          {can(CONFIG_GROUP.permission) && superAdminView && (
            <div className="mt-5 border-t border-sidebar-border/70 pt-4">
              {!collapsed ? (
                <button
                  type="button"
                  onClick={() => setConfigOpen((v) => !v)}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/45 transition-colors hover:text-sidebar-foreground/80"
                >
                  <UserCog className="h-3.5 w-3.5 text-primary" />
                  <span className="flex-1 text-left">ADMIN · {t(CONFIG_GROUP.labelKey, lang)}</span>
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-150", !configOpen && "-rotate-90")} />
                </button>
              ) : (
                <div className="my-2 border-t border-sidebar-border/50" />
              )}
              {(configOpen || collapsed) && (
                <div className="mt-1 space-y-0.5">
                  {CONFIG_GROUP.items.filter((n) => can(n.permission)).map((item) => (
                    <NavLinkItem key={item.to} item={item} collapsed={collapsed} active={isActive(item.to)} lang={lang} />
                  ))}
                </div>
              )}
            </div>
          )}

          {can(SETTINGS_GROUP.permission) && (
            <div className="pt-3">
              {!collapsed && (
                <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/45">{t(SETTINGS_GROUP.labelKey, lang)}</p>
              )}
              {SETTINGS_GROUP.items.filter((n) => can(n.permission)).map((item) => (
                <NavLinkItem key={item.to} item={item} collapsed={collapsed} active={isActive(item.to)} lang={lang} />
              ))}
            </div>
          )}
        </nav>

        <div className={cn("mt-auto border-t border-sidebar-border/60 p-3", collapsed && "px-2")}>
          <div className={cn("flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5", collapsed && "justify-center px-2")}>
            <Avatar className="h-9 w-9 ring-1 ring-white/10">
              <AvatarFallback className="bg-gradient-to-br from-primary to-brand text-xs font-semibold text-primary-foreground">{initials}</AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-sidebar-foreground">{user.name}</p>
                <p className="truncate text-[11px] text-sidebar-foreground/55">{ROLE_LABEL[role]} · {user.department}</p>
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
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-white/10 bg-[#0D0D0F] px-4 text-[#F5F5F2] md:px-5">
          <div className="relative w-full max-w-lg">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
              <Input
                placeholder="Search documents, workflows, people…"
                className="h-9 rounded-lg border-white/10 bg-white/[0.06] pl-9 text-sm text-white shadow-none placeholder:text-white/40 focus-visible:border-primary/60 focus-visible:ring-1 focus-visible:ring-primary/50"
              />
              <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 select-none items-center gap-1 rounded border border-white/10 bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-white/50 sm:inline-flex">⌘K</kbd>
          </div>

          <div className="flex-1" />

          {!superAdminView && (
            <Button asChild variant="default" size="sm" className="hidden h-9 gap-2 rounded-lg bg-primary text-primary-foreground shadow-none hover:bg-primary-hover md:inline-flex">
              <Link to="/documents/new">
                <Plus className="h-4 w-4" />
                Quick create
              </Link>
            </Button>
          )}

          {availableRoles.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-2 rounded-lg border-white/15 bg-white/[0.06] text-white shadow-none hover:bg-white/10 hover:text-white">
                  <span className="hidden text-white/50 sm:inline">View as</span>
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
            className="h-9 w-9 rounded-lg border-white/15 bg-white/[0.06] text-white shadow-none hover:bg-white/10 hover:text-white"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          <NotificationBell />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2.5 rounded-lg px-1.5 py-1 transition-colors hover:bg-white/10">
                <Avatar className="h-8 w-8 ring-1 ring-white/15">
                  <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">{initials}</AvatarFallback>
                </Avatar>
                <div className="hidden text-left sm:block">
                  <p className="text-xs font-semibold leading-tight">{user.name}</p>
                  <p className="text-[11px] leading-tight text-white/45">{ROLE_LABEL[role]}</p>
                </div>
                <ChevronDown className="hidden h-3.5 w-3.5 text-white/45 sm:block" />
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

        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">{children}</main>
        <nav className="fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-5 border-t border-white/10 bg-[#0D0D0F] px-2 md:hidden">
          {MAIN_NAV.slice(0, 5).filter((item) => can(item.permission)).map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to);
            return (
              <Link key={item.to} to={item.to} className={cn("flex flex-col items-center justify-center gap-1 text-[10px]", active ? "text-primary" : "text-white/55")}>
                <Icon className="h-5 w-5" />
                <span>{t(item.labelKey, lang)}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
