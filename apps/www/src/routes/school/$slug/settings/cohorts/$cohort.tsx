import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { Effect, Option } from "effect";
import type { ReactElement } from "react";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import { SchoolCohortSettings } from "@/components/tenant/settings/cohort";
import { PAGE_SIZE as COHORT_MEMBER_PAGE_SIZE } from "@/components/tenant/settings/cohort/members";
import { readOnce } from "@/lib/convex/read";
import { readCohortId } from "@/lib/tenant/params";
import { readCohortFn } from "@/lib/tenant/settings.functions";

/** One cohort of the school. A failed address to a cohort is not found for every viewer. */
export const Route = createFileRoute("/school/$slug/settings/cohorts/$cohort")({
  beforeLoad: ({ params }) => {
    const cohortId = readCohortId(params.cohort);
    if (Option.isNone(cohortId)) {
      throw notFound();
    }
    return { cohortId: cohortId.value };
  },
  loader: ({ context }) => {
    if (context.school._tag !== "Member") {
      return;
    }
    // After a press the cohort's detail reads once from Convex; its members then read live.
    if (!context.firstHtml) {
      return Effect.runPromise(
        readOnce(tenancy.cohorts.get, {
          cohortId: context.cohortId,
          slug: context.slug,
        }).pipe(
          Effect.map((detail) => ({ detail })),
          Effect.orElseSucceed(() => undefined)
        )
      );
    }
    return readCohortFn({
      data: {
        cohortId: context.cohortId,
        numItems: COHORT_MEMBER_PAGE_SIZE,
        slug: context.slug,
      },
    });
  },
  component: SchoolCohortPage,
  notFoundComponent: SchoolPageNotFound,
});

function SchoolCohortPage(): ReactElement {
  const { cohortId, slug } = Route.useRouteContext();
  const preload = Route.useLoaderData();
  return (
    <SchoolCohortSettings cohortId={cohortId} preload={preload} slug={slug} />
  );
}
