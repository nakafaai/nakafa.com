import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import {
  PAGE_SIZE,
  SchoolMembersSettings,
} from "@/components/tenant/settings/members";
import { readMembersFn } from "@/lib/tenant/settings.functions";

/** The members of the school. */
export const Route = createFileRoute("/school/$slug/settings/members")({
  loader: ({ context }) =>
    context.firstHtml && context.school._tag === "Member"
      ? readMembersFn({ data: { numItems: PAGE_SIZE, slug: context.slug } })
      : undefined,
  component: SchoolMembersPage,
});

function SchoolMembersPage(): ReactElement {
  const { slug } = Route.useRouteContext();
  const first = Route.useLoaderData();
  return <SchoolMembersSettings first={first} slug={slug} />;
}
