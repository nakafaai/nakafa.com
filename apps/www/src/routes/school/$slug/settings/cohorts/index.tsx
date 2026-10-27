import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { SchoolCohortsSettings } from "@/components/tenant/settings/cohorts";

/** The cohorts of the school, by period. The tab opens the school's first active unit. */
export const Route = createFileRoute("/school/$slug/settings/cohorts/")({
  component: SchoolCohortsPage,
});

function SchoolCohortsPage(): ReactElement {
  const { slug } = Route.useRouteContext();
  return <SchoolCohortsSettings slug={slug} />;
}
