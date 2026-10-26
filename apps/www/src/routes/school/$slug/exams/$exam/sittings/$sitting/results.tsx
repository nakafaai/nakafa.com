import exams from "@repo/backend/confect/_generated/refs/exams";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { Effect, Option } from "effect";
import type { ReactElement } from "react";
import { SittingResults } from "@/components/exams/results/screen";
import { STUDENT_PAGE_SIZE } from "@/components/exams/results/students";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import { readOnce } from "@/lib/convex/read";
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
    // After a press the header's overview reads once from Convex; the students then read live.
    if (!context.firstHtml) {
      return Effect.runPromise(
        readOnce(exams.results.results.overview, {
          sittingId: context.sittingId,
          slug: context.slug,
        }).pipe(
          Effect.map((overview) => ({ overview })),
          Effect.orElseSucceed(() => undefined)
        )
      );
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
