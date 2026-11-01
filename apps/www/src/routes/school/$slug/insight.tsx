import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { SchoolInsight } from "@/components/tenant/insight/page";

/** Insight of the school: a teacher's classes, or a student's own standing. */
export const Route = createFileRoute("/school/$slug/insight")({
  component: SchoolInsightPage,
});

function SchoolInsightPage(): ReactElement {
  return <SchoolInsight />;
}
