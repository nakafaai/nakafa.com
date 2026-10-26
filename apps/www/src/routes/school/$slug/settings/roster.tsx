import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { RosterImportSettings } from "@/components/tenant/roster/import";

/** The Dapodik import and export of the school, which its Admin and Staff keep. */
export const Route = createFileRoute("/school/$slug/settings/roster")({
  component: SchoolRosterPage,
});

function SchoolRosterPage(): ReactElement {
  const { slug } = Route.useRouteContext();
  return <RosterImportSettings slug={slug} />;
}
