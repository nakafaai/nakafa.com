import { createFileRoute } from "@tanstack/react-router";
import { Option } from "effect";
import type { ReactElement } from "react";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import { SchoolCohortSettings } from "@/components/tenant/settings/cohort";
import { guardSchoolPage } from "@/lib/tenant/guard";
import { readCohortId } from "@/lib/tenant/params";

/** One cohort of the school. A failed address to a cohort is not found for every viewer. */
export const Route = createFileRoute("/school/$slug/settings/cohorts/$cohort")({
  beforeLoad: guardSchoolPage({
    reads: (params: { readonly cohort: string }) =>
      Option.all({ cohortId: readCohortId(params.cohort) }),
  }),
  notFoundComponent: SchoolPageNotFound,
  component: SchoolCohortPage,
});

function SchoolCohortPage(): ReactElement {
  const { cohortId, slug } = Route.useRouteContext();
  return <SchoolCohortSettings cohortId={cohortId} slug={slug} />;
}
