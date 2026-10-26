import { Id } from "@repo/backend/confect/_generated/id";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { Option, Schema } from "effect";
import type { ReactElement } from "react";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import { CohortReports } from "@/components/tenant/reports/sheet";

/** The ID a report page's address names, or none for an address no cohort holds. */
const readCohortId = Schema.decodeUnknownOption(Id("tenantCohorts"));

/** The report cards of one class group, which its homeroom teacher, the principal, and the Admin open. */
export const Route = createFileRoute("/school/$slug/reports/$cohortId")({
  beforeLoad: ({ params }) => {
    const cohortId = readCohortId(params.cohortId);
    if (Option.isNone(cohortId)) {
      throw notFound();
    }
    return { cohortId: cohortId.value };
  },
  component: SchoolCohortReportsPage,
  notFoundComponent: SchoolPageNotFound,
});

function SchoolCohortReportsPage(): ReactElement {
  const { cohortId, slug } = Route.useRouteContext();
  return <CohortReports cohortId={cohortId} slug={slug} />;
}
