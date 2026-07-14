import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet, Link, createRootRouteWithContext, useRouter, useRouterState,
  HeadContent, Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { RoleProvider, useSession, requiredPermissionForPath } from "@/lib/wdas/role-context";
import { LanguageProvider } from "@/lib/wdas/language-context";
import { ThemeProvider } from "@/lib/wdas/theme-context";
import { UsersProvider } from "@/lib/wdas/users-context";
import { AppShell } from "@/components/wdas/app-shell";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">The page you're looking for doesn't exist or has been moved.</p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">Something went wrong on our end. You can try refreshing or head back home.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }} className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">Try again</button>
          <a href="/" className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent">Go home</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "WDAS · Workflow Document Approval System" },
      { name: "description", content: "Enterprise document routing, review, and approval platform." },
      { property: "og:title", content: "WDAS · Workflow Document Approval System" },
      { property: "og:description", content: "Enterprise document routing, review, and approval platform." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function AuthedGate() {
  const { isAuthed, can } = useSession();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isLogin = pathname === "/login" || pathname === "/";
  const isExternal = pathname.startsWith("/external");
  const isDesign = pathname.startsWith("/design");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setHydrated(true), 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!hydrated || isExternal || isDesign) return;
    if (!isAuthed && !isLogin) router.navigate({ to: "/login" });
    if (isAuthed && pathname === "/login") router.navigate({ to: "/dashboard" });
    if (isAuthed && pathname === "/") router.navigate({ to: "/dashboard" });
    if (isAuthed && !isLogin) {
      // Dashboard is always the safe landing page for authenticated users.
      if (pathname === "/dashboard") return;
      const required = requiredPermissionForPath(pathname);
      if (required && !can(required)) {
        router.navigate({ to: "/dashboard" });
      }
    }
  }, [hydrated, isAuthed, isLogin, isExternal, isDesign, pathname, router, can]);

  if (isExternal || isDesign || isLogin || !isAuthed) return <Outlet />;
  return <AppShell><Outlet /></AppShell>;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RoleProvider>
          <LanguageProvider>
          <UsersProvider>
            <AuthedGate />
          </UsersProvider>
          </LanguageProvider>
          <Toaster richColors position="top-right" />
        </RoleProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
