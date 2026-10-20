import { createFileRoute, notFound } from "@tanstack/react-router";
import { Option } from "effect";
import type { ReactElement } from "react";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import { SchoolCohortSettings } from "@/components/tenant/settings/cohort";
import { readCohortId } from "@/lib/tenant/params";

/** One cohort of the school. */
export const Route = createFileRoute("/school/$slug/settings/cohorts/$cohort")({
  beforeLoad: ({ context, params }) => {
    const cohortId = readCohortId(params.cohort);
    if (context.school._tag === "Member" && Option.isNone(cohortId)) {
      throw notFound();
    }
    return { cohortId: Option.getOrNull(cohortId) };
  },
  component: SchoolCohortPage,
  notFoundComponent: SchoolPageNotFound,
});

function SchoolCohortPage(): ReactElement | null {
  const { cohortId, slug } = Route.useRouteContext();
  if (cohortId === null) {
    return null;
  }
  return <SchoolCohortSettings cohortId={cohortId} slug={slug} />;
}
