import { createFileRoute, notFound } from "@tanstack/react-router";
import { Option } from "effect";
import type { ReactElement } from "react";
import { CohortGraduation } from "@/components/tenant/graduation/sheet";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import { readCohortId } from "@/lib/tenant/params";

/** The graduation of one class group, which the principal, the Admin, and Staff open. */
export const Route = createFileRoute("/school/$slug/graduation/$cohortId")({
  beforeLoad: ({ params }) => {
    const cohortId = readCohortId(params.cohortId);
    if (Option.isNone(cohortId)) {
      throw notFound();
    }
    return { cohortId: cohortId.value };
  },
  component: SchoolCohortGraduationPage,
  notFoundComponent: SchoolPageNotFound,
});

function SchoolCohortGraduationPage(): ReactElement {
  return <CohortGraduation />;
}
