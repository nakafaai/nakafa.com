import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import { canOpenReports } from "@/components/tenant/reports/access";
import { ReportCohorts } from "@/components/tenant/reports/cohorts";
import { guardSchoolPage } from "@/lib/tenant/guard";

/** The report cards of the school: the class groups whose reports the viewer opens. */
export const Route = createFileRoute("/school/$slug/reports/")({
  beforeLoad: guardSchoolPage({ opens: canOpenReports }),
  notFoundComponent: SchoolPageNotFound,
  component: SchoolReportsPage,
});

function SchoolReportsPage(): ReactElement {
  const { slug } = Route.useRouteContext();
  return <ReportCohorts slug={slug} />;
}
