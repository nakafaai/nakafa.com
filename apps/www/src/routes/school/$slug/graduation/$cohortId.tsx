import { Id } from "@repo/backend/confect/_generated/id";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { Option, Schema } from "effect";
import type { ReactElement } from "react";
import { CohortGraduation } from "@/components/tenant/graduation/sheet";
import { SchoolPageNotFound } from "@/components/tenant/notfound";

/** The ID a graduation page's address names, or none for an address no cohort holds. */
const readCohortId = Schema.decodeUnknownOption(Id("tenantCohorts"));

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
