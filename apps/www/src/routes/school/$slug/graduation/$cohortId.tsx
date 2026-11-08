import { createFileRoute, notFound } from "@tanstack/react-router";
import { Option } from "effect";
import type { ReactElement } from "react";
import { canOpenGraduation } from "@/components/tenant/graduation/access";
import { CohortGraduation } from "@/components/tenant/graduation/sheet";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import { readCohortId } from "@/lib/tenant/params";

/**
 * The graduation of one class group, which the principal, the Admin, and Staff open. A viewer
 * who opens no graduation reads not found here, as on the graduation list, and never asks for it.
 */
export const Route = createFileRoute("/school/$slug/graduation/$cohortId")({
  beforeLoad: ({ context, params }) => {
    const { school } = context;
    const cohortId = readCohortId(params.cohortId);
    if (
      Option.isNone(cohortId) ||
      (school._tag === "Member" && !canOpenGraduation(school.viewer))
    ) {
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
