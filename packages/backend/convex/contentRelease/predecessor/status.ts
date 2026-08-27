import {
  hasActivePredecessorIdentity,
  storedPredecessorIdentity,
} from "@repo/backend/convex/contentRelease/predecessor/identity";
import type {
  PredecessorFields,
  PredecessorReadFields,
} from "@repo/backend/convex/contentRelease/predecessor/rows";
import type { PredecessorIdentity } from "@repo/backend/convex/contentRelease/predecessor/spec";

/** Builds route evidence only from durable observation rows. */
function buildRoutes(rows: PredecessorFields) {
  const routeStatus = (row: PredecessorReadFields) => ({
    armedAt: row.armedAt,
    invocationCount: row.invocationCount,
    ...(row.lastInvokedAt === undefined
      ? {}
      : { lastInvokedAt: row.lastInvokedAt }),
    phase: row.phase,
    quietSince: row.quietSince,
    route: row.route,
    ...(row.sealedAt === undefined ? {} : { sealedAt: row.sealedAt }),
  });
  return {
    batch: routeStatus(rows.batch),
    history: routeStatus(rows.history),
    protected: routeStatus(rows.protected),
    singular: routeStatus(rows.singular),
  };
}

/** Builds status without deriving time from a cacheable query execution. */
export function buildPredecessorStatus(
  rows: PredecessorFields,
  active: PredecessorIdentity
) {
  const common = {
    deploymentName: rows.singular.deploymentName,
    observationId: rows.singular.observationId,
    routes: buildRoutes(rows),
  };
  if (hasActivePredecessorIdentity(rows, active)) {
    return { ...common, active, kind: "active" as const };
  }
  return {
    ...common,
    kind: "drifted" as const,
    live: active,
    stored: storedPredecessorIdentity(rows),
  };
}
