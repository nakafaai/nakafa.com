import { createFileRoute, notFound } from "@tanstack/react-router";
import { Option } from "effect";
import type { ReactElement } from "react";
import { SittingResults } from "@/components/exams/results/screen";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import { readExamId, readSittingId } from "@/lib/tenant/params";

/** The results of one sitting, for the proctor of the exam. */
export const Route = createFileRoute(
  "/school/$slug/exams/$exam/sittings/$sitting/results"
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
  component: SittingResultsPage,
  notFoundComponent: SchoolPageNotFound,
});

function SittingResultsPage(): ReactElement {
  const { examId, sittingId, slug } = Route.useRouteContext();
  return Option.match(Option.all([examId, sittingId]), {
    onNone: () => <></>,
    onSome: ([exam, sitting]) => (
      <SittingResults examId={exam} sittingId={sitting} slug={slug} />
    ),
  });
}
