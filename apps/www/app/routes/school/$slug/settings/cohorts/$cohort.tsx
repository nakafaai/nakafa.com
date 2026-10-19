import { createFileRoute, notFound } from "@tanstack/react-router";
import { Option } from "effect";
import type { ReactElement } from "react";
import { SchoolCohortSettings } from "@/components/tenant/settings/cohort";
import { readCohortId } from "@/lib/tenant/params";

/** One cohort of the school. */
export const Route = createFileRoute("/school/$slug/settings/cohorts/$cohort")({
  beforeLoad: ({ params }) => {
    const cohortIdOption = readCohortId(params.cohort);
    if (Option.isNone(cohortIdOption)) {
      throw notFound();
    }
    return { cohortId: cohortIdOption.value };
  },
  component: SchoolCohortPage,
});

function SchoolCohortPage(): ReactElement {
  const { cohortId, slug } = Route.useRouteContext();
  return <SchoolCohortSettings cohortId={cohortId} slug={slug} />;
}
