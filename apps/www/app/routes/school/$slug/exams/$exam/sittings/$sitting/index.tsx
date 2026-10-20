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
    return { examId, sittingId };
  },
  component: SittingDashboardPage,
  notFoundComponent: SchoolPageNotFound,
});

function SittingDashboardPage(): ReactElement {
  const { examId, sittingId, slug } = Route.useRouteContext();
  return Option.match(Option.all([examId, sittingId]), {
    onNone: () => <></>,
    onSome: ([exam, sitting]) => (
      <SittingDashboard examId={exam} sittingId={sitting} slug={slug} />
    ),
  });
}
