import { createFileRoute } from "@tanstack/react-router";
import { Option } from "effect";
import type { ReactElement } from "react";
import { SchoolCohortsSettings } from "@/components/tenant/settings/cohorts";
import { firstActiveUnitOf } from "@/lib/tenant/frame";
import { readCohortsFn } from "@/lib/tenant/settings.functions";

/**
 * The cohorts of the school, by period. The tab opens the school's first active unit, so its active period
 * and that period's cohorts are read with the page.
 */
export const Route = createFileRoute("/school/$slug/settings/cohorts/")({
  loader: ({ context }) => {
    if (!context.firstHtml || context.school._tag !== "Member") {
      return;
    }
    const unit = Option.getOrUndefined(
      firstActiveUnitOf(context.school.viewer.units)
    );
    if (unit === undefined) {
      return;
    }
    return readCohortsFn({ data: { slug: context.slug, unitId: unit.id } });
  },
  component: SchoolCohortsPage,
});

function SchoolCohortsPage(): ReactElement {
  const { slug } = Route.useRouteContext();
  const preload = Route.useLoaderData();
  return <SchoolCohortsSettings preload={preload} slug={slug} />;
}
