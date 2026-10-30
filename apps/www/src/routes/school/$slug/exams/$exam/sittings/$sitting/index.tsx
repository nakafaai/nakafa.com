import { Id } from "@repo/backend/confect/_generated/id";
import exams from "@repo/backend/confect/_generated/refs/exams";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { Effect, Option, Schema } from "effect";
import type { ReactElement } from "react";
import { dashboardArgs } from "@/components/exams/sitting/change";
import { SittingDashboard } from "@/components/exams/sitting/dashboard";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import { readOnce } from "@/lib/convex/read";
import { readSittingDashboardFn } from "@/lib/tenant/exams.functions";
import { readExamId, readSittingId } from "@/lib/tenant/params";

/**
 * The seat the proctor selected, as the address carries it: its attempt, and the cursor of the
 * dashboard page that holds it when that is not the first page. The address keeps the choice, so a
 * seat is a link that opens its panel even before the page's script runs, and a reload keeps it.
 */
const DashboardSearch = Schema.Struct({
  page: Schema.optional(Schema.String),
  seat: Schema.optional(Id("examAttempts")),
});

/**
 * The proctor's dashboard of one sitting. The dashboard's own query decides whether the viewer may
 * see it, and a failed address to the exam or the sitting is not found for every viewer.
 */
export const Route = createFileRoute(
  "/school/$slug/exams/$exam/sittings/$sitting/"
)({
  validateSearch: Schema.toStandardSchemaV1(DashboardSearch),
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
