import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/wdas/page-header";
import { useSession } from "@/lib/wdas/role-context";
import { P } from "@/lib/wdas/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Network, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { wdasConfig } from "@/services/wdas-config";

export const Route = createFileRoute("/config/active-directory")({
  component: ActiveDirectoryPage,
});

interface AdForm {
  enabled: boolean;
  domainName: string;
  port: string;
  useSsl: boolean;
}

const DEFAULT_FORM: AdForm = { enabled: false, domainName: "", port: "389", useSsl: false };

function ActiveDirectoryPage() {
  const router = useRouter();
  const { can } = useSession();
  const qc = useQueryClient();
  const [settings, setSettings] = useState<AdForm>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!can(P.config.ad)) router.navigate({ to: "/dashboard" });
  }, [can, router]);

  const settingsQ = useQuery({
    queryKey: ["ad-settings"],
    queryFn: () => wdasConfig.getActiveDirectorySettings(),
    enabled: can(P.config.ad),
  });

  useEffect(() => {
    if (settingsQ.data) {
      setSettings({
        enabled: settingsQ.data.enabled,
        domainName: settingsQ.data.domainName,
        port: String(settingsQ.data.port || 389),
        useSsl: settingsQ.data.useSsl,
      });
    }
  }, [settingsQ.data]);

  if (!can(P.config.ad)) return null;

  const update = <K extends keyof AdForm>(key: K, value: AdForm[K]) =>
    setSettings((cur) => ({ ...cur, [key]: value }));

  const portNum = Number(settings.port);
  const portError = settings.port.length > 0 && (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535)
    ? "Port must be a number between 1 and 65535."
    : "";

  const save = async () => {
    if (settings.enabled && !settings.domainName.trim()) {
      toast.error("Domain name is required when Active Directory is enabled.");
      return;
    }
    if (portError) {
      toast.error(portError);
      return;
    }
    setSaving(true);
    try {
      const saved = await wdasConfig.updateActiveDirectorySettings({
        enabled: settings.enabled,
        domainName: settings.domainName.trim(),
        port: Number(settings.port) || 389,
        useSsl: settings.useSsl,
      });
      setSettings({
        enabled: saved.enabled,
        domainName: saved.domainName,
        port: String(saved.port || 389),
        useSsl: saved.useSsl,
      });
      await qc.invalidateQueries({ queryKey: ["ad-settings"] });
      await qc.invalidateQueries({ queryKey: ["ad-status"] });
      toast.success("Active Directory settings saved.");
    } catch (err) {
      toast.error((err as Error).message || "Could not save Active Directory settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full bg-[#f6f4ef] dark:bg-[#090b0f]">
      <PageHeader
        title="Active Directory"
        subtitle="Configure the connection to your Active Directory server. Settings are stored in the database. Only Super Admin can access this page."
      />

      <div className="p-6 lg:p-8">
        <Card className="max-w-2xl border-amber-400/30 bg-white shadow-sm dark:bg-zinc-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Network className="h-5 w-5 text-amber-600" />
              Connection settings
            </CardTitle>
            <CardDescription>
              Set your AD domain and LDAP port for user authentication and sync.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {settingsQ.isLoading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading settings…
              </p>
            ) : settingsQ.isError ? (
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-destructive">Could not load settings.</span>
                <button type="button" className="text-primary hover:underline" onClick={() => settingsQ.refetch()}>
                  Retry
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3">
                  <div>
                    <Label className="text-sm font-medium">Enable Active Directory</Label>
                    <p className="text-xs text-muted-foreground">Turn on to authenticate and sync users via AD.</p>
                  </div>
                  <Switch
                    checked={settings.enabled}
                    onCheckedChange={(v) => update("enabled", v)}
                    disabled={saving || !can(P.config.adMake)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ad-domain">Domain name *</Label>
                  <Input
                    id="ad-domain"
                    value={settings.domainName}
                    onChange={(e) => update("domainName", e.target.value)}
                    placeholder="company.local"
                    disabled={saving || !can(P.config.adMake)}
                  />
                  <p className="text-xs text-muted-foreground">e.g. company.local or corp.example.com</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ad-port">Port *</Label>
                  <Input
                    id="ad-port"
                    inputMode="numeric"
                    value={settings.port}
                    onChange={(e) => update("port", e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="389"
                    disabled={saving || !can(P.config.adMake)}
                    aria-invalid={!!portError}
                  />
                  {portError
                    ? <p className="text-xs text-destructive">{portError}</p>
                    : <p className="text-xs text-muted-foreground">Standard LDAP is 389, LDAPS (SSL) is 636.</p>}
                </div>

                <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3">
                  <div>
                    <Label className="text-sm font-medium">Use SSL (LDAPS)</Label>
                    <p className="text-xs text-muted-foreground">Enable for encrypted connections (typically port 636).</p>
                  </div>
                  <Switch
                    checked={settings.useSsl}
                    onCheckedChange={(v) => update("useSsl", v)}
                    disabled={saving || !can(P.config.adMake)}
                  />
                </div>

                {can(P.config.adMake) && (
                  <Button type="button" className="bg-amber-400 text-zinc-950 hover:bg-amber-300" onClick={save} disabled={saving || !!portError}>
                    {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</> : "Save settings"}
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
