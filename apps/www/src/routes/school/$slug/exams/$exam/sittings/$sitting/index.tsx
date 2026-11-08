import { createFileRoute } from "@tanstack/react-router";
import { Option } from "effect";
import type { ReactElement } from "react";
import {
  DashboardRecovery,
  SittingDashboard,
} from "@/components/exams/sitting/dashboard";
import { dashboardSearch } from "@/components/exams/sitting/search";
import { guardSchoolPage } from "@/lib/tenant/guard";
import { readExamId, readSittingId } from "@/lib/tenant/params";

/**
 * The proctor's dashboard of one sitting. The dashboard's own query decides whether the viewer may
 * see it, and a failed address to the exam or the sitting is not found for every viewer.
 */
export const Route = createFileRoute(
  "/school/$slug/exams/$exam/sittings/$sitting/"
)({
  validateSearch: dashboardSearch,
  ...guardSchoolPage({
    reads: (params: { readonly exam: string; readonly sitting: string }) =>
      Option.all({
        examId: readExamId(params.exam),
        sittingId: readSittingId(params.sitting),
      }),
  }),
  component: SittingDashboardPage,
});

function SittingDashboardPage(): ReactElement | null {
  const { examId, sittingId, slug } = Route.useRouteContext();
  return (
    <DashboardRecovery>
      <SittingDashboard examId={examId} sittingId={sittingId} slug={slug} />
    </DashboardRecovery>
  );
}
