import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { SchoolRolesSettings } from "@/components/tenant/settings/roles";

/** The roles of the people of the school. */
export const Route = createFileRoute("/school/$slug/settings/roles")({
  component: SchoolRolesPage,
});

function SchoolRolesPage(): ReactElement {
  const { slug } = Route.useRouteContext();
  return <SchoolRolesSettings slug={slug} />;
}
