import { createFileRoute, notFound } from "@tanstack/react-router";
import { Option } from "effect";
import type { ReactElement } from "react";
import { SittingDashboard } from "@/components/exams/sitting/dashboard";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import { readExamId, readSittingId } from "@/lib/tenant/params";

/** The proctor's dashboard of one sitting. The dashboard's own query decides whether the viewer may see it. */
export const Route = createFileRoute(
  "/school/$slug/exams/$exam/sittings/$sitting/"
)({
  beforeLoad: ({ context, params }) => {
    const examId = readExamId(params.exam);
    const sittingId = readSittingId(params.sitting);
    if (
      context.school._tag === "Member" &&
      (Option.isNone(examId) || Option.isNone(sittingId))
    ) {
      throw notFound();
    }
    return {
      examId: Option.getOrNull(examId),
      sittingId: Option.getOrNull(sittingId),
    };
  },
  component: SittingDashboardPage,
  notFoundComponent: SchoolPageNotFound,
});

function SittingDashboardPage(): ReactElement | null {
  const { examId, sittingId, slug } = Route.useRouteContext();
  if (examId === null || sittingId === null) {
    return null;
  }
  return <SittingDashboard examId={examId} sittingId={sittingId} slug={slug} />;
}
