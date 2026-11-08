import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { canOpenGraduation } from "@/components/tenant/graduation/access";
import { GraduationCohorts } from "@/components/tenant/graduation/cohorts";
import { guardSchoolPage } from "@/lib/tenant/guard";

/** The graduation of the school: the graduating class groups the viewer opens. */
export const Route = createFileRoute("/school/$slug/graduation/")({
  ...guardSchoolPage({ opens: canOpenGraduation }),
  component: SchoolGraduationPage,
});

function SchoolGraduationPage(): ReactElement {
  const { slug } = Route.useRouteContext();
  return <GraduationCohorts slug={slug} />;
}
