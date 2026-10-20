import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import {
  PAGE_SIZE,
  SchoolClientsSettings,
} from "@/components/tenant/settings/clients";
import { readClientsFn } from "@/lib/tenant/settings.functions";

/** The integration clients of the school. */
export const Route = createFileRoute("/school/$slug/settings/clients")({
  loader: ({ context }) =>
    context.school._tag === "Member"
      ? readClientsFn({ data: { numItems: PAGE_SIZE, slug: context.slug } })
      : undefined,
  component: SchoolClientsPage,
});

function SchoolClientsPage(): ReactElement {
  const { slug } = Route.useRouteContext();
  const first = Route.useLoaderData();
  return <SchoolClientsSettings first={first} slug={slug} />;
}
