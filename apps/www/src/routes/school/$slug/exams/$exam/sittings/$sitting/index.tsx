import exams from "@repo/backend/confect/_generated/refs/exams";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { Effect, Option } from "effect";
import type { ReactElement } from "react";
import { dashboardArgs } from "@/components/exams/sitting/change";
import { SittingDashboard } from "@/components/exams/sitting/dashboard";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import { readOnce } from "@/lib/convex/read";
import { readSittingDashboardFn } from "@/lib/tenant/exams.functions";
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
  loader: ({ context }) => {
    if (context.school._tag !== "Member") {
      return;
    }
    // After a press the dashboard reads once from Convex, then live.
    if (!context.firstHtml) {
      return Effect.runPromise(
        readOnce(
          exams.sittings.dashboard,
          dashboardArgs(
            { sittingId: context.sittingId, slug: context.slug },
            null
          )
        ).pipe(Effect.orElseSucceed(() => undefined))
      );
    }
    return readSittingDashboardFn({
      data: { sittingId: context.sittingId, slug: context.slug },
    });
  },
  component: SittingDashboardPage,
  notFoundComponent: SchoolPageNotFound,
});

function SittingDashboardPage(): ReactElement | null {
  const { examId, sittingId, slug } = Route.useRouteContext();
  const preload = Route.useLoaderData();
  return (
    <SittingDashboard
      examId={examId}
      preload={preload}
      sittingId={sittingId}
      slug={slug}
    />
  );
}
