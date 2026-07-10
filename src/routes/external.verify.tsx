import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ExternalShell } from "./external.login";
import { api, setToken } from "@/lib/api/client";
import type { ApiExternalSessionDto } from "@/lib/api/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/external/verify")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  component: ExternalVerify,
});

const TOTAL_SECONDS = 600;

function readSecureLinkToken(): string {
  try {
    return sessionStorage.getItem("wdas.externalLinkToken") ?? "";
  } catch {
    return "";
  }
}

function ExternalVerify() {
  const router = useRouter();
  const { token: tokenFromUrl } = Route.useSearch();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(TOTAL_SECONDS);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (tokenFromUrl) {
      try {
        sessionStorage.setItem("wdas.externalLinkToken", tokenFromUrl);
      } catch { /* ignore */ }
    }
  }, [tokenFromUrl]);

  useEffect(() => {
    if (remaining <= 0) return;
    const t = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, [remaining]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const expired = remaining === 0;

  const submit = async () => {
    if (code.length !== 6) return;
    const secureLinkToken = readSecureLinkToken();
    if (!secureLinkToken) {
      setError("Session expired. Request a new invitation link.");
      return;
    }
    setBusy(true);
    try {
      if (expired) {
        router.navigate({ to: "/external/expired" });
        return;
      }
      const res = await api.post<ApiExternalSessionDto>("/api/external-sessions/verify-otp", {
        secureLinkToken,
        otp: code,
      });
      setToken(res.accessToken);
      sessionStorage.setItem(
        "wdas.externalSession",
        JSON.stringify({ documentId: res.documentId, workflowStepId: res.workflowStepId }),
      );
      toast.success("Verified", { description: "Loading document…" });
      router.navigate({ to: "/external/documents/$token", params: { token: secureLinkToken } });
    } catch (e) {
      setError((e as Error).message || "Incorrect code. Please try again.");
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  const resend = () => {
    setRemaining(TOTAL_SECONDS);
    setError(null);
    toast.success("Request a new invitation from the document owner.");
  };

  return (
    <ExternalShell>
      <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Enter verification code</CardTitle>
          <CardDescription>
            {tokenFromUrl
              ? "Use the one-time code from your invitation email to continue."
              : "Enter the 6-digit code we emailed you. The code expires in 10 minutes."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="otp">One-time code</Label>
            <InputOTP
              id="otp"
              maxLength={6}
              value={code}
              onChange={(v) => { setError(null); setCode(v); }}
              disabled={expired}
              aria-invalid={!!error}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
              </InputOTPGroup>
              <InputOTPSeparator />
              <InputOTPGroup>
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {expired ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>This code has expired. Request a new one.</AlertDescription>
            </Alert>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Expires in <span className="font-mono">{String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}</span>
            </div>
          )}

          <Button className="w-full" onClick={submit} disabled={code.length !== 6 || busy || expired}>
            {busy ? "Verifying…" : "Verify and continue"}
          </Button>

          <div className="flex items-center justify-between text-xs">
            <button
              type="button" onClick={resend} disabled={!expired}
              className="text-primary underline-offset-2 hover:underline disabled:pointer-events-none disabled:text-muted-foreground disabled:no-underline"
            >
              Resend code {expired ? "" : "(available when expired)"}
            </button>
            <button type="button" onClick={() => router.navigate({ to: "/external/login" })} className="text-muted-foreground hover:text-foreground">
              Use different email
            </button>
          </div>
        </CardContent>
      </Card>
      </div>
    </ExternalShell>
  );
}
