import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/wdas/page-header";
import { useSession } from "@/lib/wdas/role-context";
import { useLanguage } from "@/lib/wdas/language-context";
import { wdasConfig } from "@/services/wdas-config";
import { useUsers } from "@/lib/wdas/users-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { UserCheck, Globe, User, Bell, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings/")({
  component: SettingsPage,
});

type Lang = "en" | "ur";
const LABELS: Record<Lang, Record<string, string>> = {
  en: {
    profile: "Profile",
    language: "Language",
    notifications: "Notification preferences",
    delegation: "Delegation & Out-of-Office",
    save: "Save preferences",
  },
  ur: {
    profile: "پروفائل",
    language: "زبان",
    notifications: "اطلاعات کی ترجیحات",
    delegation: "تفویض / آفس سے باہر",
    save: "ترجیحات محفوظ کریں",
  },
};

function SettingsPage() {
  const { user } = useSession();
  const { getUser } = useUsers();
  const { lang, setLang } = useLanguage();
  const manager = user.managerId ? getUser(user.managerId) : undefined;
  const initials = user.name.split(" ").map((n) => n[0]).slice(0, 2).join("");
  const t = LABELS[lang];

  const events = [
    { key: "submit", label: "Document submitted" },
    { key: "approve", label: "Approval / step passed" },
    { key: "reject", label: "Document rejected" },
    { key: "return", label: "Document returned" },
    { key: "reminder", label: "SLA reminder / escalation" },
    { key: "finalize", label: "Document finalized" },
  ] as const;
  type EventKey = typeof events[number]["key"];
  type Channel = "email" | "inApp" | "sms";

  const [prefs, setPrefs] = useState<Record<EventKey, Record<Channel, boolean>>>({
    submit: { email: true, inApp: true, sms: false },
    approve: { email: true, inApp: true, sms: false },
    reject: { email: true, inApp: true, sms: true },
    return: { email: true, inApp: true, sms: false },
    reminder: { email: true, inApp: true, sms: false },
    finalize: { email: false, inApp: true, sms: false },
  });

  const [oooMessage, setOooMessage] = useState("");

  useEffect(() => {
    void wdasConfig.getUserPreferences().then((p) => {
      if (p.notificationPreferencesJson) {
        try {
          setPrefs(JSON.parse(p.notificationPreferencesJson));
        } catch { /* ignore */ }
      }
      if (p.outOfOfficeMessage) setOooMessage(p.outOfOfficeMessage);
    });
  }, []);

  const save = async () => {
    await wdasConfig.saveUserPreferences({
      notificationPreferences: JSON.stringify(prefs),
      outOfOfficeMessage: oooMessage || null,
      preferredLanguage: lang,
    });
    toast.success("Preferences saved", { description: "Notification settings updated." });
  };

  return (
    <div>
      <PageHeader
        title={lang === "en" ? "Account settings" : "اکاؤنٹ کی ترتیبات"}
        subtitle={lang === "en" ? "Manage your profile, language, and notification preferences." : "اپنی پروفائل، زبان اور اطلاعات کی ترجیحات کا انتظام کریں۔"}
      />
      <div className={cn("grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_320px]", lang === "ur" && "text-right")} dir={lang === "ur" ? "rtl" : "ltr"}>
        <div className="space-y-6">
          {/* Profile */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><User className="h-4 w-4" /> {t.profile}</CardTitle>
              <CardDescription>Read-only, synced from Active Directory.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14">
                  <AvatarFallback className="bg-primary text-base text-primary-foreground">{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-base font-semibold">{user.name}</p>
                  <p className="text-sm text-muted-foreground">{user.designation} · {user.department}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label="AD ID" value={user.adId} mono />
                <Field label="Department" value={user.department} />
                <Field label="Designation" value={user.designation} />
                <Field label="Manager" value={manager?.name ?? "—"} />
                <Field label="Status" value={<Badge className="border-success/30 bg-success/15 text-success" variant="outline">{user.status ?? "active"}</Badge>} />
                <Field label="App role" value={<Badge variant="outline">{user.appRole ?? "Maker"}</Badge>} />
              </div>
            </CardContent>
          </Card>

          {/* Language */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><Globe className="h-4 w-4" /> {t.language}</CardTitle>
              <CardDescription>{lang === "en" ? "Preview localization — key labels only." : "لوکلائزیشن کا مظاہرہ — صرف کلیدی لیبل۔"}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="inline-flex rounded-md border p-0.5">
                {(["en", "ur"] as const).map((l) => (
                  <button
                    key={l} type="button" onClick={() => setLang(l)}
                    className={cn(
                      "rounded px-4 py-1.5 text-sm font-medium transition-colors",
                      lang === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                    aria-pressed={lang === l}
                  >
                    {l === "en" ? "English" : "اردو"}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Notification preferences */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><Bell className="h-4 w-4" /> {t.notifications}</CardTitle>
              <CardDescription>{lang === "en" ? "Choose how you want to be notified for each event." : "ہر ایونٹ کے لیے اطلاعات کا طریقہ منتخب کریں۔"}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-[1fr_90px_90px] items-center gap-2 border-y bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground">
                <span>Event</span><span>Email</span><span>In-app</span>
              </div>
              {events.map((ev) => (
                <div key={ev.key} className="grid grid-cols-[1fr_90px_90px] items-center gap-2 border-b px-4 py-2.5 last:border-0">
                  <span className="text-sm">{ev.label}</span>
                  {(["email", "inApp"] as Channel[]).map((ch) => (
                    <Switch
                      key={ch}
                      checked={prefs[ev.key][ch]}
                      onCheckedChange={(v) => setPrefs((p) => ({ ...p, [ev.key]: { ...p[ev.key], [ch]: v } }))}
                      aria-label={`${ev.label} — ${ch}`}
                    />
                  ))}
                </div>
              ))}
              <div className="flex justify-end p-4">
                <Button onClick={() => void save()}>{t.save}</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Out-of-office message</CardTitle>
              <CardDescription>Shown to colleagues when you are away (stored on your profile).</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={3}
                value={oooMessage}
                onChange={(e) => setOooMessage(e.target.value)}
                placeholder="I am out of office until… Please contact my delegate for urgent approvals."
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar shortcuts */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base"><UserCheck className="h-4 w-4 text-info" /> {t.delegation}</CardTitle>
              <CardDescription>{lang === "en"
                ? "Route your approvals to another user while you're away."
                : "غیر حاضری کے دوران اپنی منظوریاں کسی اور کو منتقل کریں۔"}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full justify-between">
                <Link to="/settings/delegation">
                  <span>{lang === "en" ? "Open delegation settings" : "تفویض کی ترتیبات کھولیں"}</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className={cn("mt-0.5 text-sm", mono && "font-mono")}>{value}</div>
    </div>
  );
}
