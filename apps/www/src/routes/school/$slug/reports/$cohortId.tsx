import { createFileRoute, notFound } from "@tanstack/react-router";
import { Option } from "effect";
import type { ReactElement } from "react";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import { CohortReports } from "@/components/tenant/reports/sheet";
import { readCohortId } from "@/lib/tenant/params";

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
  return <CohortReports />;
}
