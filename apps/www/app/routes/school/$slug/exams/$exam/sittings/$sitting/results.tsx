import { createFileRoute, notFound } from "@tanstack/react-router";
import { Option } from "effect";
import type { ReactElement } from "react";
import { SittingResults } from "@/components/exams/results/screen";
import { readExamId, readSittingId } from "@/lib/tenant/params";

/** The results of one sitting, for the proctor of the exam. */
export const Route = createFileRoute(
  "/school/$slug/exams/$exam/sittings/$sitting/results"
)({
  beforeLoad: ({ params }) => {
    const examIdOption = readExamId(params.exam);
    const sittingIdOption = readSittingId(params.sitting);
    if (Option.isNone(examIdOption) || Option.isNone(sittingIdOption)) {
      throw notFound();
    }
    return { examId: examIdOption.value, sittingId: sittingIdOption.value };
  },
  component: SittingResultsPage,
});

function SittingResultsPage(): ReactElement {
  const { examId, sittingId, slug } = Route.useRouteContext();
  return <SittingResults examId={examId} sittingId={sittingId} slug={slug} />;
}
