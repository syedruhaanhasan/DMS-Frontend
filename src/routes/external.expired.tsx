import { createFileRoute } from "@tanstack/react-router";
import { ExternalShell } from "./external.login";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Mail } from "lucide-react";

export const Route = createFileRoute("/external/expired")({
  component: ExternalExpired,
});

function ExternalExpired() {
  return (
    <ExternalShell>
      <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <CardTitle>This approval link has expired</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            For security reasons, external approval links expire 7 days after they're sent
            (or immediately after use). Please contact the document owner to request a new link.
          </p>
          <div className="rounded-md border bg-muted/40 p-3 text-xs">
            <p className="font-medium text-foreground">What to include when requesting a new link</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              <li>The document subject or reference number</li>
              <li>The email address you were invited on</li>
              <li>Approximate date the original invitation was sent</li>
            </ul>
          </div>
          <Button asChild variant="outline" className="w-full">
            <a href="mailto:support@wdas.internal">
              <Mail className="mr-2 h-4 w-4" /> Contact document owner
            </a>
          </Button>
        </CardContent>
      </Card>
      </div>
    </ExternalShell>
  );
}
