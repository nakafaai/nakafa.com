import { createFileRoute, notFound } from "@tanstack/react-router";
import { Option } from "effect";
import type { ReactElement } from "react";
import { SittingDashboard } from "@/components/exams/sitting/dashboard";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import { readExamId, readSittingId } from "@/lib/tenant/params";

/**
 * The proctor's dashboard of one sitting. The dashboard's own query decides whether the viewer may
 * see it, and a failed address to the exam or the sitting is not found for every viewer.
 */
export const Route = createFileRoute(
  "/school/$slug/exams/$exam/sittings/$sitting/"
)({
  beforeLoad: ({ params }) => {
    const examId = readExamId(params.exam);
    const sittingId = readSittingId(params.sitting);
    if (Option.isNone(examId) || Option.isNone(sittingId)) {
      throw notFound();
    }
    return { examId: examId.value, sittingId: sittingId.value };
  },
  component: SittingDashboardPage,
  notFoundComponent: SchoolPageNotFound,
});

function SittingDashboardPage(): ReactElement | null {
  const { examId, sittingId, slug } = Route.useRouteContext();
  return <SittingDashboard examId={examId} sittingId={sittingId} slug={slug} />;
}
