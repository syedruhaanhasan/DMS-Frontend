import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSession } from "@/lib/wdas/role-context";
import { ApiError } from "@/lib/api/client";
import { Building2, Loader2, ShieldCheck, AlertCircle, Crown, Eye, EyeOff, LockKeyhole, CheckCircle2 } from "lucide-react";

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
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

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
        setError(err.message);
      } else {
        setError((err as Error).message || "Sign in failed. Check your credentials and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen bg-[#FAFAF7] lg:grid-cols-[55%_45%]">
      <section className="topographic-pattern relative hidden overflow-hidden bg-[#0D0D0F] p-12 text-[#F5F5F2] lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div className="relative z-10 flex items-center gap-3">
          <img src="/veriflow-logo.jpg" alt="VeriFlow" className="h-11 w-11 rounded-xl bg-white object-contain p-1" />
          <div>
            <p className="text-base font-semibold tracking-[0.12em]">VeriFlow</p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">Enterprise document control</p>
          </div>
        </div>

        <div className="relative z-10 max-w-xl">
          <div className="mb-6 h-1 w-14 rounded-full bg-[#FFC400]" />
          <h1 className="text-balance text-4xl font-semibold leading-[1.14] tracking-[-0.035em] xl:text-5xl">
            Documents. Workflows.<br />Approvals. One System.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-white/55">
            Secure document governance and auditable approvals for regulated organizations.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-3 gap-6 border-t border-white/10 pt-7">
          {[
            ["99.99%", "Platform uptime"],
            ["2.4M+", "Documents processed"],
            ["180+", "Organizations"],
          ].map(([value, label]) => (
            <div key={label}>
              <p className="tabular-nums text-xl font-semibold text-[#FFC400]">{value}</p>
              <p className="mt-1 text-xs text-white/45">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[440px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <img src="/veriflow-logo.jpg" alt="VeriFlow" className="h-10 w-10 rounded-xl bg-white object-contain p-0.5" />
            <p className="font-semibold tracking-[0.12em]">VeriFlow</p>
          </div>

          <Card className="border-[#E4E4E0] bg-white p-7 shadow-[0_1px_2px_rgba(13,13,15,0.04)] sm:p-9">
            <div className="mb-7">
              <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl bg-[#111114] text-[#FFC400]">
                <LockKeyhole className="h-5 w-5" />
              </div>
              <h2 className="text-2xl font-semibold tracking-[-0.025em] text-[#111114]">Welcome back</h2>
              <p className="mt-1.5 text-sm text-[#6B6B70]">Sign in to your secure workspace.</p>
            </div>

            <form onSubmit={onSubmit}>
              {error && (
                <Alert variant="destructive" className="mb-5 border-[#D64545]/25 bg-[#D64545]/5">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-[#111114]">Email or Employee ID</Label>
                  <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" placeholder="name@organization.com" disabled={loading} autoFocus className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-[#111114]">Password</Label>
                  <div className="relative">
                    <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="••••••••" disabled={loading} className="h-11 pr-11" />
                    <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-[#6B6B70] hover:text-[#111114]" aria-label={showPassword ? "Hide password" : "Show password"}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between text-sm">
                <label className="flex cursor-pointer items-center gap-2 text-[#55555B]">
                  <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="h-4 w-4 accent-[#FFC400]" />
                  Remember me
                </label>
                <button type="button" className="font-medium text-[#111114] underline decoration-[#FFC400] decoration-2 underline-offset-4">Forgot password?</button>
              </div>

              <Button type="submit" className="mt-6 h-11 w-full bg-[#FFC400] font-semibold text-[#111114] hover:bg-[#E6B000]" disabled={loading}>
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in…</> : "Sign In"}
              </Button>

              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-[#E4E4E0]" />
                <span className="text-xs text-[#8A8A92]">or</span>
                <div className="h-px flex-1 bg-[#E4E4E0]" />
              </div>

              <Button type="button" variant="outline" className="h-11 w-full border-[#D8D8D4] bg-white text-[#111114] hover:bg-[#F3F3EF]">
                <Building2 className="mr-2 h-4 w-4" /> Sign in with SSO / Active Directory
              </Button>
            </form>

            <details className="mt-6 border-t border-[#E4E4E0] pt-4">
              <summary className="cursor-pointer text-center text-xs font-medium text-[#6B6B70]">Development accounts</summary>
              <div className="mt-3 grid gap-2">
                {TEST_ACCOUNTS.map((account) => {
                  const Icon = account.icon;
                  const active = username === account.username;
                  return (
                    <button key={account.username} type="button" onClick={() => fillAccount(account)} disabled={loading} className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-left text-xs hover:bg-[#FAFAF7] ${active ? "border-[#FFC400] bg-[#FFF9E6]" : "border-[#E4E4E0]"}`}>
                      <Icon className="h-4 w-4 text-[#6B6B70]" />
                      <span className="flex-1"><strong className="block text-[#111114]">{account.label}</strong><span className="text-[#6B6B70]">{account.username}</span></span>
                      {active && <CheckCircle2 className="h-4 w-4 text-[#2E9E5B]" />}
                    </button>
                  );
                })}
              </div>
            </details>
          </Card>

          <p className="mt-6 text-center text-xs text-[#8A8A92]">VeriFlow v2.6.0 · © 2026 Enterprise Systems</p>
        </div>
      </section>
    </main>
  );
}
