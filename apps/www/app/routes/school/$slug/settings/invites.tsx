import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { SchoolInvitesSettings } from "@/components/tenant/settings/invites";

/** The pending invites of the school. */
export const Route = createFileRoute("/school/$slug/settings/invites")({
  component: SchoolInvitesPage,
});

function SchoolInvitesPage(): ReactElement {
  const { slug } = Route.useRouteContext();
  return <SchoolInvitesSettings slug={slug} />;
}
