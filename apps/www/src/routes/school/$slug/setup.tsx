import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import { SchoolSetup } from "@/components/tenant/setup/page";
import { guardSchoolPage } from "@/lib/tenant/guard";
import { canManageSchool } from "@/lib/tenant/manage";

/** The setup of the school. Only a viewer who may manage the school sees it. */
export const Route = createFileRoute("/school/$slug/setup")({
  beforeLoad: guardSchoolPage({
    opens: (viewer) => canManageSchool(viewer.can),
  }),
  notFoundComponent: SchoolPageNotFound,
  component: SchoolSetupPage,
});

function SchoolSetupPage(): ReactElement {
  return <SchoolSetup />;
}
