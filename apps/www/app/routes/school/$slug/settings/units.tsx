import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { SchoolUnitsSettings } from "@/components/tenant/settings/units";

/** The units of the school, with their time zones and content languages. */
export const Route = createFileRoute("/school/$slug/settings/units")({
  component: SchoolUnitsPage,
});

function SchoolUnitsPage(): ReactElement {
  const { slug } = Route.useRouteContext();
  return <SchoolUnitsSettings slug={slug} />;
}
