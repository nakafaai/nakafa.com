import { createFileRoute, notFound } from "@tanstack/react-router";
import { Option } from "effect";
import type { ReactElement } from "react";
import { SittingResults } from "@/components/exams/results/screen";
import { STUDENT_PAGE_SIZE } from "@/components/exams/results/students";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import { readResultsFn } from "@/lib/tenant/exams.functions";
import { readExamId, readSittingId } from "@/lib/tenant/params";

/** The results of one sitting, for the proctor of the exam. */
export const Route = createFileRoute(
  "/school/$slug/exams/$exam/sittings/$sitting/results"
)({
  beforeLoad: ({ params }) => {
    const examId = readExamId(params.exam);
    const sittingId = readSittingId(params.sitting);
    if (Option.isNone(examId) || Option.isNone(sittingId)) {
      throw notFound();
    }
    return { examId: examId.value, sittingId: sittingId.value };
  },
  loader: ({ context }) => {
    if (context.school._tag !== "Member") {
      return;
    }
    return readResultsFn({
      data: {
        numItems: STUDENT_PAGE_SIZE,
        sittingId: context.sittingId,
        slug: context.slug,
      },
    });
  },
  component: SittingResultsPage,
  notFoundComponent: SchoolPageNotFound,
});

function SittingResultsPage(): ReactElement | null {
  const { examId, sittingId, slug } = Route.useRouteContext();
  const preload = Route.useLoaderData();
  return (
    <SittingResults
      examId={examId}
      preload={preload}
      sittingId={sittingId}
      slug={slug}
    />
  );
}
