import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { SchoolPeriodsSettings } from "@/components/tenant/settings/periods";

/** The periods of the school, by unit. The tab opens the school's first active unit. */
export const Route = createFileRoute("/school/$slug/settings/periods")({
  component: SchoolPeriodsPage,
});

function SchoolPeriodsPage(): ReactElement {
  const { slug } = Route.useRouteContext();
  return <SchoolPeriodsSettings slug={slug} />;
}
