import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/wdas/page-header";
import { useSession, isSuperAdmin } from "@/lib/wdas/role-context";
import { P } from "@/lib/wdas/permissions";
import { ApprovalModeBuilder } from "@/components/wdas/approval-mode-builder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";
import type { Workflow } from "@/lib/wdas/types";

export const Route = createFileRoute("/config/approval-modes")({
  component: ApprovalModesReference,
});

function ApprovalModesReference() {
  const router = useRouter();
  const { can } = useSession();
  useEffect(() => { if (!can(P.config.approvalModes)) router.navigate({ to: "/dashboard" }); }, [can, router]);

  const [wf, setWf] = useState<Partial<Workflow>>({
    mode: "matrix",
    matrixBands: [
      { id: "b1", min: 0, max: 100000, approverUserIds: [], approverGroupIds: [], sequence: "sequential" },
      { id: "b2", min: 100001, max: 500000, approverUserIds: [], approverGroupIds: [], sequence: "sequential" },
      { id: "b3", min: 500001, max: null, approverUserIds: [], approverGroupIds: [], sequence: "sequential" },
    ],
    groups: [
      { id: "g1", name: "Managers", memberIds: ["u3", "u6"], rule: "any" },
      { id: "g2", name: "Directors", memberIds: ["u2", "u5"], rule: "all" },
    ],
  });

  return (
    <div className="min-h-full bg-[#f6f4ef] dark:bg-[#090b0f]">
      <PageHeader
        title="Approval Modes"
        subtitle="Reference for the four supported approval modes. Configure a real workflow to save changes."
      />
      <div className="space-y-4 p-6 lg:p-8">
        <Alert className="border-amber-400/40 bg-amber-400/10">
          <Info className="h-4 w-4" />
          <AlertTitle>Sandbox</AlertTitle>
          <AlertDescription>
            Changes here are local to this page and won't affect any live workflow. Use the Workflows screen to configure actual approval routing.
          </AlertDescription>
        </Alert>

        <Card className="border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <CardHeader className="pb-3"><CardTitle className="text-base">Try the builder</CardTitle></CardHeader>
          <CardContent><ApprovalModeBuilder value={wf} onChange={(patch) => setWf((prev) => ({ ...prev, ...patch }))} /></CardContent>
        </Card>
      </div>
    </div>
  );
}
