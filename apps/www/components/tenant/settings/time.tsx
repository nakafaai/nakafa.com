"use client";

import { QueryResult, useQuery } from "@confect/react";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr, Option } from "effect";
import { useLocale } from "next-intl";
import { useConvexAuth } from "@/components/providers/convex";
import { schoolDateTimeText } from "@/components/tenant/settings/clock";

/**
 * Renders one moment as the school's clock shows it: the date and time in the time
 * zone of the school's first active unit, in the reader's language. It renders
 * nothing until the school is read, so the time never shows in another zone first.
 */
export function SchoolDateTime({ at, slug }: { at: number; slug: TenantSlug }) {
  const locale = useLocale();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const viewer = useQuery(tenancy.viewer.get, isSettled ? { slug } : "skip");
  const timeZone = QueryResult.isSuccess(viewer)
    ? Option.getOrUndefined(
        Arr.findFirst(viewer.value.units, (unit) => unit.status === "active")
      )?.timeZone
    : undefined;

  if (timeZone === undefined) {
    return null;
  }

  return <>{schoolDateTimeText({ at, locale, timeZone })}</>;
}
