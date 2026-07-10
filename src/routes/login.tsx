import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSession } from "@/lib/wdas/role-context";
import { ApiError } from "@/lib/api/client";
import { Building2, Loader2, ShieldCheck, AlertCircle, Crown } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: Login,
});

const TEST_ACCOUNTS = [
  {
    label: "Super Admin",
    username: "superadmin",
    password: "SuperAdmin123!",
    icon: Crown,
    description: "Full system access",
  },
  {
    label: "Document Owner",
    username: "maker.owner",
    password: "Owner123!",
    icon: Building2,
    description: "Create & submit documents",
  },
  {
    label: "Approver",
    username: "approver.one",
    password: "Approver123!",
    icon: ShieldCheck,
    description: "Review pending approvals",
  },
] as const;

function Login() {
  const { signIn, isAuthed } = useSession();
  const router = useRouter();
  const [username, setUsername] = useState("superadmin");
  const [password, setPassword] = useState("SuperAdmin123!");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthed) {
      router.navigate({ to: "/dashboard" });
    }
  }, [isAuthed, router]);

  const fillAccount = (account: (typeof TEST_ACCOUNTS)[number]) => {
    setUsername(account.username);
    setPassword(account.password);
    setError(null);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError("Enter your username and password.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await signIn(username.trim(), password);
      router.navigate({ to: "/dashboard" });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 0 || err.message.includes("Failed to fetch")) {
          setError("Cannot reach the API. Start the backend with: dotnet run --project src/WDAS.Api");
        } else {
          setError(err.message);
        }
      } else {
        setError((err as Error).message || "Sign in failed. Check your credentials and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(46,116,181,0.14),transparent_30%),linear-gradient(135deg,#f7f9fc_0%,#eef4fb_100%)] p-4">
      <Card className="w-full max-w-md overflow-hidden border-primary/10 bg-card/95 p-0 shadow-[0_20px_45px_-24px_rgba(31,56,100,0.45)]">
        <div className="bg-gradient-to-br from-primary/10 via-card to-card px-8 pb-6 pt-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Building2 className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">WDAS</h1>
          <p className="text-sm text-muted-foreground">Workflow-Based Document Approval System</p>
        </div>

        <form onSubmit={onSubmit} className="px-8 pb-8 text-left">
          <div className="mt-4 flex items-center justify-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-success" />
            Sign in to continue
          </div>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="superadmin"
                disabled={loading}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                disabled={loading}
              />
            </div>
          </div>

          <Button type="submit" className="mt-6 w-full" size="lg" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </Button>

          <div className="mt-6 space-y-2">
            <p className="text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Quick sign-in (dev)
            </p>
            <div className="grid gap-2">
              {TEST_ACCOUNTS.map((account) => {
                const Icon = account.icon;
                const active = username === account.username;
                return (
                  <button
                    key={account.username}
                    type="button"
                    onClick={() => fillAccount(account)}
                    disabled={loading}
                    className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent disabled:opacity-50 ${
                      active ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-foreground">{account.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {account.username} · {account.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
}
