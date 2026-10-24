import { createFileRoute } from "@tanstack/react-router";
import { Option } from "effect";
import type { ReactElement } from "react";
import {
  PAGE_SIZE,
  SchoolPeriodsSettings,
} from "@/components/tenant/settings/periods";
import { firstActiveUnitOf } from "@/lib/tenant/frame";
import { readPeriodsFn } from "@/lib/tenant/settings.functions";

/**
 * The periods of the school, by unit. The tab opens the school's first active unit, so its first page of
 * periods is read with the page.
 */
export const Route = createFileRoute("/school/$slug/settings/periods")({
  loader: ({ context }) => {
    if (context.school._tag !== "Member") {
      return;
    }
    const unit = Option.getOrUndefined(
      firstActiveUnitOf(context.school.viewer.units)
    );
    if (unit === undefined) {
      return;
    }
    return readPeriodsFn({
      data: { numItems: PAGE_SIZE, slug: context.slug, unitId: unit.id },
    });
  },
  component: SchoolPeriodsPage,
});

function SchoolPeriodsPage(): ReactElement {
  const { slug } = Route.useRouteContext();
  const preload = Route.useLoaderData();
  return <SchoolPeriodsSettings preload={preload} slug={slug} />;
}
