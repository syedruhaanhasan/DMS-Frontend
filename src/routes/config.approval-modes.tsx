import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/wdas/page-header";
import { useSession, isSuperAdmin } from "@/lib/wdas/role-context";
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
  const { hasRole } = useSession();
  useEffect(() => { if (!hasRole("super_admin")) router.navigate({ to: "/dashboard" }); }, [hasRole, router]);

  const [wf, setWf] = useState<Partial<Workflow>>({
    mode: "matrix",
    matrixBands: [
      { id: "b1", min: 0, max: 100000, approverGroupIds: ["g1"], sequence: "sequential" },
      { id: "b2", min: 100001, max: 500000, approverGroupIds: ["g1", "g2"], sequence: "sequential" },
      { id: "b3", min: 500001, max: null, approverGroupIds: ["g2"], sequence: "sequential" },
    ],
    groups: [
      { id: "g1", name: "Managers", memberIds: ["u3", "u6"], rule: "any" },
      { id: "g2", name: "Directors", memberIds: ["u2", "u5"], rule: "all" },
    ],
  });

  return (
    <div>
      <PageHeader
        title="Approval Modes"
        subtitle="Reference for the four supported approval modes. Configure a real workflow to save changes."
      />
      <div className="space-y-4 p-6">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Sandbox</AlertTitle>
          <AlertDescription>
            Changes here are local to this page and won't affect any live workflow. Use the Workflows screen to configure actual approval routing.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Try the builder</CardTitle></CardHeader>
          <CardContent><ApprovalModeBuilder value={wf} onChange={setWf} /></CardContent>
        </Card>
      </div>
    </div>
  );
}
