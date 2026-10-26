import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { SchoolUnitsSettings } from "@/components/tenant/settings/units";
import { readUnitsFn } from "@/lib/tenant/settings.functions";

/** The units of the school, with their time zones and content languages. */
export const Route = createFileRoute("/school/$slug/settings/units")({
  loader: ({ context }) =>
    context.firstHtml && context.school._tag === "Member"
      ? readUnitsFn({ data: { slug: context.slug } })
      : undefined,
  component: SchoolUnitsPage,
});

function SchoolUnitsPage(): ReactElement {
  const { slug } = Route.useRouteContext();
  const preload = Route.useLoaderData();
  return <SchoolUnitsSettings preload={preload} slug={slug} />;
}
