import { createFileRoute, notFound } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import { canOpenReports } from "@/components/tenant/reports/access";
import { ReportCohorts } from "@/components/tenant/reports/cohorts";

/** The report cards of the school: the class groups whose reports the viewer opens. */
export const Route = createFileRoute("/school/$slug/reports/")({
  beforeLoad: ({ context }) => {
    const { school } = context;
    if (school._tag === "Member" && !canOpenReports(school.viewer)) {
      throw notFound();
    }
  },
  component: SchoolReportsPage,
  notFoundComponent: SchoolPageNotFound,
});

function SchoolReportsPage(): ReactElement {
  const { slug } = Route.useRouteContext();
  return <ReportCohorts slug={slug} />;
}
