import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { getEffectiveTryoutStatus } from "./status";

type ActiveTryoutCatalogPage = FunctionReturnType<
  typeof api.tryouts.queries.tryouts.getActiveTryoutCatalogPage
>;

/** Keeps the first tryout catalog page size consistent across server and client. */
export const TRYOUT_CATALOG_PAGE_SIZE = 25;

/** Maps one stored latest-attempt summary to the compact badge shown in the hub. */
export function getTryoutCatalogBadgeStatus({
  latestStatus,
  nowMs,
}: {
  latestStatus: ActiveTryoutCatalogPage["page"][number]["latestAttempt"];
  nowMs: number;
}) {
  if (!latestStatus) {
    return null;
  }

  const effectiveStatus = getEffectiveTryoutStatus({
    expiresAtMs: latestStatus.expiresAtMs,
    nowMs,
    status: latestStatus.status,
  });

  if (effectiveStatus === "in-progress") {
    return "in-progress" as const;
  }

  if (effectiveStatus === "expired") {
    return "expired" as const;
  }

  if (effectiveStatus !== null) {
    return "completed" as const;
  }

  return null;
}
