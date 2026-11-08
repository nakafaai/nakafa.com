import { createFileRoute } from "@tanstack/react-router";
import { Option } from "effect";
import type { ReactElement } from "react";
import { canOpenGraduation } from "@/components/tenant/graduation/access";
import { CohortGraduation } from "@/components/tenant/graduation/sheet";
import { guardSchoolPage } from "@/lib/tenant/guard";
import { readCohortId } from "@/lib/tenant/params";

/**
 * The graduation of one class group, which the principal, the Admin, and Staff open. A viewer
 * who opens no graduation reads not found here, as on the graduation list, and never asks for it.
 */
export const Route = createFileRoute("/school/$slug/graduation/$cohortId")({
  ...guardSchoolPage({
    opens: canOpenGraduation,
    reads: (params: { readonly cohortId: string }) =>
      Option.all({ cohortId: readCohortId(params.cohortId) }),
  }),
  component: SchoolCohortGraduationPage,
});

function SchoolCohortGraduationPage(): ReactElement {
  return <CohortGraduation />;
}
