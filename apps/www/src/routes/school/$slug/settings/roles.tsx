import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import {
  PAGE_SIZE,
  SchoolRolesSettings,
} from "@/components/tenant/settings/roles";
import { readRolesFn } from "@/lib/tenant/settings.fn";

/** The roles of the people of the school. */
export const Route = createFileRoute("/school/$slug/settings/roles")({
  loader: ({ context }) =>
    context.school._tag === "Member"
      ? readRolesFn({ data: { numItems: PAGE_SIZE, slug: context.slug } })
      : undefined,
  component: SchoolRolesPage,
});

function SchoolRolesPage(): ReactElement {
  const { slug } = Route.useRouteContext();
  const first = Route.useLoaderData();
  return <SchoolRolesSettings first={first} slug={slug} />;
}
