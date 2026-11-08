import { createFileRoute } from "@tanstack/react-router";
import { Option } from "effect";
import type { ReactElement } from "react";
import { CohortReports } from "@/components/tenant/reports/sheet";
import { guardSchoolPage } from "@/lib/tenant/guard";
import { readCohortId } from "@/lib/tenant/params";

/** The report cards of one class group, which its homeroom teacher, the principal, and the Admin open. */
export const Route = createFileRoute("/school/$slug/reports/$cohortId")({
  ...guardSchoolPage({
    reads: (params: { readonly cohortId: string }) =>
      Option.all({ cohortId: readCohortId(params.cohortId) }),
  }),
  component: SchoolCohortReportsPage,
});

function SchoolCohortReportsPage(): ReactElement {
  return <CohortReports />;
}
