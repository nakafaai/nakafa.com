import { createFileRoute, notFound } from "@tanstack/react-router";
import { Option } from "effect";
import type { ReactElement } from "react";
import { SittingDashboard } from "@/components/exams/sitting/dashboard";
import { readExamId, readSittingId } from "@/lib/tenant/params";

/** The proctor's dashboard of one sitting. The dashboard's own query decides whether the viewer may see it. */
export const Route = createFileRoute(
  "/school/$slug/exams/$exam/sittings/$sitting/"
)({
  beforeLoad: ({ params }) => {
    const examIdOption = readExamId(params.exam);
    const sittingIdOption = readSittingId(params.sitting);
    if (Option.isNone(examIdOption) || Option.isNone(sittingIdOption)) {
      throw notFound();
    }
    return { examId: examIdOption.value, sittingId: sittingIdOption.value };
  },
  component: SittingDashboardPage,
});

function SittingDashboardPage(): ReactElement {
  const { examId, sittingId, slug } = Route.useRouteContext();
  return <SittingDashboard examId={examId} sittingId={sittingId} slug={slug} />;
}
