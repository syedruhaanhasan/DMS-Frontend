import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/wdas/page-header";
import { useSession } from "@/lib/wdas/role-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Network, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/config/active-directory")({
  component: ActiveDirectoryPage,
});

const STORAGE_KEY = "wdas.adSettings";

interface AdSettings {
  enabled: boolean;
  domainName: string;
  port: string;
}

const DEFAULT_SETTINGS: AdSettings = {
  enabled: false,
  domainName: "",
  port: "389",
};

function readStoredSettings(): AdSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AdSettings & { host?: string; baseDn?: string; useSsl?: boolean }>;
    return {
      enabled: parsed.enabled ?? DEFAULT_SETTINGS.enabled,
      domainName: parsed.domainName ?? DEFAULT_SETTINGS.domainName,
      port: parsed.port ?? DEFAULT_SETTINGS.port,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function ActiveDirectoryPage() {
  const router = useRouter();
  const { hasRole } = useSession();
  const [settings, setSettings] = useState<AdSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!hasRole("super_admin")) router.navigate({ to: "/dashboard" });
  }, [hasRole, router]);

  useEffect(() => {
    setSettings(readStoredSettings());
  }, []);

  if (!hasRole("super_admin")) return null;

  const update = <K extends keyof AdSettings>(key: K, value: AdSettings[K]) =>
    setSettings((cur) => ({ ...cur, [key]: value }));

  const portNum = Number(settings.port);
  const portError = settings.port.length > 0 && (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535)
    ? "Port must be a number between 1 and 65535."
    : "";

  const save = () => {
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
      const normalized: AdSettings = {
        enabled: settings.enabled,
        domainName: settings.domainName.trim(),
        port: settings.port.trim() || "389",
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      setSettings(normalized);
      toast.success("Active Directory settings saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Active Directory"
        subtitle="Configure the connection to your Active Directory server. Only Super Admin can access this page."
      />

      <div className="p-6">
        <Card className="max-w-lg border-primary/20 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Network className="h-5 w-5 text-primary" />
              Connection settings
            </CardTitle>
            <CardDescription>
              Set your AD domain and LDAP port for user authentication and sync.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3">
              <div>
                <Label className="text-sm font-medium">Enable Active Directory</Label>
                <p className="text-xs text-muted-foreground">Turn on to authenticate and sync users via AD.</p>
              </div>
              <Switch
                checked={settings.enabled}
                onCheckedChange={(v) => update("enabled", v)}
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ad-domain">Domain name *</Label>
              <Input
                id="ad-domain"
                value={settings.domainName}
                onChange={(e) => update("domainName", e.target.value)}
                placeholder="company.local"
                disabled={saving}
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
                disabled={saving}
                aria-invalid={!!portError}
              />
              {portError
                ? <p className="text-xs text-destructive">{portError}</p>
                : <p className="text-xs text-muted-foreground">Standard LDAP is 389, LDAPS (SSL) is 636.</p>}
            </div>

            <Button type="button" onClick={save} disabled={saving || !!portError}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</> : "Save settings"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
