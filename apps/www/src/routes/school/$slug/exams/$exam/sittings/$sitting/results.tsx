import { createFileRoute } from "@tanstack/react-router";
import { Option } from "effect";
import type { ReactElement } from "react";
import { SittingResults } from "@/components/exams/results/screen";
import { guardSchoolPage } from "@/lib/tenant/guard";
import { readExamId, readSittingId } from "@/lib/tenant/params";

/** The results of one sitting, for the proctor of the exam. */
export const Route = createFileRoute(
  "/school/$slug/exams/$exam/sittings/$sitting/results"
)({
  ...guardSchoolPage({
    reads: (params: { readonly exam: string; readonly sitting: string }) =>
      Option.all({
        examId: readExamId(params.exam),
        sittingId: readSittingId(params.sitting),
      }),
  }),
  component: SittingResultsPage,
});

function SittingResultsPage(): ReactElement | null {
  const { examId, sittingId, slug } = Route.useRouteContext();
  return <SittingResults examId={examId} sittingId={sittingId} slug={slug} />;
}
