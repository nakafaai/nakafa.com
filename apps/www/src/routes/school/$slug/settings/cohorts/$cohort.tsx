import { createFileRoute, notFound } from "@tanstack/react-router";
import { Option } from "effect";
import type { ReactElement } from "react";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import {
  PAGE_SIZE as COHORT_MEMBER_PAGE_SIZE,
  SchoolCohortSettings,
} from "@/components/tenant/settings/cohort";
import { readCohortId } from "@/lib/tenant/params";
import { readCohortFn } from "@/lib/tenant/settings.fn";

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
