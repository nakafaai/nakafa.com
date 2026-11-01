import { createFileRoute, notFound } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { canOpenInsight } from "@/components/tenant/insight/access";
import { SchoolInsight } from "@/components/tenant/insight/page";
import { SchoolPageNotFound } from "@/components/tenant/notfound";

/** Insight of the school: the classes a viewer reads, or a student's own standing. */
export const Route = createFileRoute("/school/$slug/insight")({
  beforeLoad: ({ context }) => {
    const { school } = context;
    if (school._tag === "Member" && !canOpenInsight(school.viewer)) {
      throw notFound();
    }
  },
  component: SchoolInsightPage,
  notFoundComponent: SchoolPageNotFound,
});

function SchoolInsightPage(): ReactElement {
  return <SchoolInsight />;
}
