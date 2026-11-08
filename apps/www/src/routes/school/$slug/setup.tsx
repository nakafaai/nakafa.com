import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { SchoolSetup } from "@/components/tenant/setup/page";
import { canManageSchool } from "@/lib/tenant/frame";
import { guardSchoolPage } from "@/lib/tenant/guard";

/** The setup of the school. Only a viewer who may manage the school sees it. */
export const Route = createFileRoute("/school/$slug/setup")({
  ...guardSchoolPage({ opens: (viewer) => canManageSchool(viewer.can) }),
  component: SchoolSetupPage,
});

function SchoolSetupPage(): ReactElement {
  return <SchoolSetup />;
}
