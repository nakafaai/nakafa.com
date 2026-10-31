import { createFileRoute, notFound } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { canOpenGraduation } from "@/components/tenant/graduation/access";
import { GraduationCohorts } from "@/components/tenant/graduation/cohorts";
import { SchoolPageNotFound } from "@/components/tenant/notfound";

/** The graduation of the school: the graduating class groups the viewer opens. */
export const Route = createFileRoute("/school/$slug/graduation/")({
  beforeLoad: ({ context }) => {
    const { school } = context;
    if (school._tag === "Member" && !canOpenGraduation(school.viewer)) {
      throw notFound();
    }
  },
  component: SchoolGraduationPage,
  notFoundComponent: SchoolPageNotFound,
});

function SchoolGraduationPage(): ReactElement {
  const { slug } = Route.useRouteContext();
  return <GraduationCohorts slug={slug} />;
}
