import { createFileRoute, notFound } from "@tanstack/react-router";
import { Option } from "effect";
import type { ReactElement } from "react";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import { SchoolCohortSettings } from "@/components/tenant/settings/cohort";
import { readCohortId } from "@/lib/tenant/params";

/** One cohort of the school. A failed address to a cohort is not found for every viewer. */
export const Route = createFileRoute("/school/$slug/settings/cohorts/$cohort")({
  beforeLoad: ({ params }) => {
    const cohortId = readCohortId(params.cohort);
    if (Option.isNone(cohortId)) {
      throw notFound();
    }
    return { cohortId: cohortId.value };
  },
  component: SchoolCohortPage,
  notFoundComponent: SchoolPageNotFound,
});

function SchoolCohortPage(): ReactElement {
  const { cohortId, slug } = Route.useRouteContext();
  return <SchoolCohortSettings cohortId={cohortId} slug={slug} />;
}
