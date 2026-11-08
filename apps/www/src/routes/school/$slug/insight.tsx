import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { canOpenInsight } from "@/components/tenant/insight/access";
import { SchoolInsight } from "@/components/tenant/insight/page";
import { guardSchoolPage } from "@/lib/tenant/guard";

/** Insight of the school: the classes a viewer reads, or a student's own standing. */
export const Route = createFileRoute("/school/$slug/insight")({
  ...guardSchoolPage({ opens: canOpenInsight }),
  component: SchoolInsightPage,
});

function SchoolInsightPage(): ReactElement {
  return <SchoolInsight />;
}
