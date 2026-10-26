import { useMutation } from "@confect/react";
import type { Id } from "@repo/backend/confect/_generated/id";
import records from "@repo/backend/confect/_generated/refs/records";
import { useTransition } from "react";
import { useTenant } from "@/components/tenant/context";
import { stateChange } from "@/components/tenant/reports/change";
import { saveSchool } from "@/components/tenant/settings/save";

const SOURCE = "components/tenant/reports/actions";

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
        saveSchool(() => approve({ reportId, slug }), SOURCE)
      ),
    complete: (reportId: Id<"reportCards">) =>
      startTransition(() =>
        saveSchool(() => complete({ reportId, slug }), SOURCE)
      ),
    reopen: (reportId: Id<"reportCards">) =>
      startTransition(() =>
        saveSchool(() => reopen({ reportId, slug }), SOURCE)
      ),
  };
}
