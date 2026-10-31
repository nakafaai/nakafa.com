import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { SchoolClassesSettings } from "@/components/tenant/settings/classes";

/** The classrooms of the school, by the active period of a unit. The tab opens the school's first active unit. */
export const Route = createFileRoute("/school/$slug/settings/classes")({
  component: SchoolClassesPage,
});

function SchoolClassesPage(): ReactElement {
  const { slug } = Route.useRouteContext();
  return <SchoolClassesSettings slug={slug} />;
}
