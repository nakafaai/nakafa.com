import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { canOpenReports } from "@/components/tenant/reports/access";
import { ReportCohorts } from "@/components/tenant/reports/cohorts";
import { guardSchoolPage } from "@/lib/tenant/guard";

/** The report cards of the school: the class groups whose reports the viewer opens. */
export const Route = createFileRoute("/school/$slug/reports/")({
  ...guardSchoolPage({ opens: canOpenReports }),
  component: SchoolReportsPage,
});

function SchoolReportsPage(): ReactElement {
  const { slug } = Route.useRouteContext();
  return <ReportCohorts slug={slug} />;
}
