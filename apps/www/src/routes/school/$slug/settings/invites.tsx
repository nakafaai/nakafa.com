import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import {
  PAGE_SIZE,
  SchoolInvitesSettings,
} from "@/components/tenant/settings/invites";
import { readInvitesFn } from "@/lib/tenant/settings.functions";

/** The pending invites of the school. */
export const Route = createFileRoute("/school/$slug/settings/invites")({
  loader: ({ context }) =>
    context.firstHtml && context.school._tag === "Member"
      ? readInvitesFn({ data: { numItems: PAGE_SIZE, slug: context.slug } })
      : undefined,
  component: SchoolInvitesPage,
});

function SchoolInvitesPage(): ReactElement {
  const first = Route.useLoaderData();
  return <SchoolInvitesSettings first={first} />;
}
