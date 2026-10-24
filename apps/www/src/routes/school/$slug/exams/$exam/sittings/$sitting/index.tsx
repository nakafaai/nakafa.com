import { createFileRoute, notFound } from "@tanstack/react-router";
import { Option } from "effect";
import type { ReactElement } from "react";
import { SittingDashboard } from "@/components/exams/sitting/dashboard";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
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
