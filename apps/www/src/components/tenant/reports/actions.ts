import { useMutation } from "@confect/react";
import type { Id } from "@repo/backend/confect/_generated/id";
import records from "@repo/backend/confect/_generated/refs/records";
import { useTransition } from "react";
import { useTenant } from "@/components/tenant/context";
import { stateChange } from "@/components/tenant/reports/change";
import { runSchoolWrite, schoolCall } from "@/components/tenant/write";

/**
 * Hands a report in, takes it back, or approves it, each shown at once on the list and
 * undone if the server refuses it. The row menu and the open report share them.
 */
export function useReportActions() {
  const { slug } = useTenant();
  const complete = useMutation(records.reports.complete).withOptimisticUpdate(
    stateChange("completed")
  );
  const reopen = useMutation(records.reports.reopen).withOptimisticUpdate(
    stateChange("draft")
  );
  const approve = useMutation(records.reports.approve).withOptimisticUpdate(
    stateChange("approved")
  );
  const [, startTransition] = useTransition();

  return {
    approve: (reportId: Id<"reportCards">) =>
      startTransition(() =>
        runSchoolWrite(schoolCall(() => approve({ reportId, slug })))
      ),
    complete: (reportId: Id<"reportCards">) =>
      startTransition(() =>
        runSchoolWrite(schoolCall(() => complete({ reportId, slug })))
      ),
    reopen: (reportId: Id<"reportCards">) =>
      startTransition(() =>
        runSchoolWrite(schoolCall(() => reopen({ reportId, slug })))
      ),
  };
}
