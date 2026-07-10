import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, ShieldCheck, ArrowRight, Info } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/external/login")({
  component: ExternalLogin,
});

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ExternalLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const valid = emailRe.test(email);

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    await new Promise((r) => setTimeout(r, 600));
    setBusy(false);
    setSent(true);
    toast.success("One-time code sent", { description: `Check ${email} for a 6-digit code.` });
  };

  return (
    <ExternalShell>
      <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <CardTitle>External Approver Access</CardTitle>
          <CardDescription>
            Sign in with the email address you received the approval invitation on. We'll email you a one-time code.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!sent ? (
            <form
              className="space-y-4"
              onSubmit={(e) => { e.preventDefault(); submit(); }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="email">Email address</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email" type="email" autoComplete="email" required
                    maxLength={255}
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@partner.com" className="pl-8"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={!valid || busy}>
                {busy ? "Sending code…" : "Email me a code"} <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Don't have an invitation? Contact the document owner.
              </p>
            </form>
          ) : (
            <div className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  We've sent a 6-digit verification code to <b>{email}</b>. It expires in 10 minutes.
                </AlertDescription>
              </Alert>
              <Button className="w-full" onClick={() => router.navigate({ to: "/external/verify" })}>
                Enter code
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setSent(false)}>Use a different email</Button>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </ExternalShell>
  );
}

export function ExternalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-muted/30">
      <header className="border-b bg-card px-6 py-3">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-primary text-sm font-bold text-primary-foreground">W</div>
          <div>
            <p className="text-sm font-semibold">WDAS</p>
            <p className="text-[11px] text-muted-foreground">External Approver Portal</p>
          </div>
        </div>
      </header>
      <main className="flex-1 px-4 py-10">
        <div className="mx-auto w-full max-w-3xl">{children}</div>
      </main>
      <footer className="border-t bg-card py-3 text-center text-[11px] text-muted-foreground">
        Secure access · All actions are logged with IP and timestamp
      </footer>
    </div>
  );
}
