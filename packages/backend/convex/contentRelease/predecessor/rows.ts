import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  PREDECESSOR_ROUTES,
  type PredecessorObservationId,
  type PredecessorRoute,
} from "@repo/backend/convex/contentRelease/predecessor/spec";
import { Clock, Effect } from "effect";

export type PredecessorReadCtx = MutationCtx | QueryCtx;
type PredecessorRead = Doc<"contentPredecessorReads">;
export type PredecessorReadFields = Omit<
  PredecessorRead,
  "_creationTime" | "_id"
>;

export interface StoredPredecessorRows {
  readonly batch: PredecessorRead | null;
  readonly history: PredecessorRead | null;
  readonly protected: PredecessorRead | null;
  readonly singular: PredecessorRead | null;
}

export interface PredecessorFields {
  readonly batch: PredecessorReadFields;
  readonly history: PredecessorReadFields;
  readonly protected: PredecessorReadFields;
  readonly singular: PredecessorReadFields;
}

export interface PredecessorRows {
  readonly batch: PredecessorRead;
  readonly history: PredecessorRead;
  readonly protected: PredecessorRead;
  readonly singular: PredecessorRead;
}

interface PredecessorPair {
  readonly batch: PredecessorRead;
  readonly singular: PredecessorRead;
}

/** Reads one route through its exact bounded index and rejects duplicates. */
const loadRoute = Effect.fn("contentRelease.predecessor.loadRoute")(function* (
  ctx: PredecessorReadCtx,
  route: PredecessorRoute
) {
  const rows = yield* Effect.promise(() =>
    ctx.db
      .query("contentPredecessorReads")
      .withIndex("by_route", (query) => query.eq("route", route))
      .take(2)
  );
  if (rows.length > 1) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Predecessor ${route} observation is duplicated.`
    );
  }
  return rows[0] ?? null;
});

/** Reads every route row without scanning the temporary table. */
export const loadPredecessorRows = Effect.fn(
  "contentRelease.predecessor.loadRows"
)(function* (ctx: PredecessorReadCtx) {
  return yield* Effect.all(
    {
      batch: loadRoute(ctx, "batch"),
      history: loadRoute(ctx, "history"),
      protected: loadRoute(ctx, "protected"),
      singular: loadRoute(ctx, "singular"),
    },
    { concurrency: "unbounded" }
  );
});

/** Validates the exact two-route shape deployed before protected observation. */
const requirePredecessorPair = Effect.fn(
  "contentRelease.predecessor.requirePair"
)(function* (rows: StoredPredecessorRows) {
  const { batch, history, protected: protectedRoute, singular } = rows;
  if (!(singular && batch) || protectedRoute || history) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      "Predecessor observation is not an expandable two-route pair."
    );
  }
  if (
    singular.observationId !== batch.observationId ||
    singular.activeManifestHash !== batch.activeManifestHash ||
    singular.activeReleaseId !== batch.activeReleaseId ||
    singular.activeSequence !== batch.activeSequence ||
    singular.armedAt !== batch.armedAt ||
    singular.deploymentName !== batch.deploymentName ||
    singular.phase !== batch.phase ||
    (singular.phase === "sealed" &&
      (singular.sealedAt === undefined ||
        singular.sealedAt !== batch.sealedAt)) ||
    (singular.phase === "armed" &&
      (singular.sealedAt !== undefined || batch.sealedAt !== undefined))
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Predecessor two-route observation has conflicting identity."
    );
  }
  return { batch, singular } satisfies PredecessorPair;
});

/** Expands the deployed two-route observer without crediting unobserved time. */
export const expandPredecessorRows = Effect.fn(
  "contentRelease.predecessor.expandRows"
)(function* (ctx: MutationCtx, stored: StoredPredecessorRows) {
  if (PREDECESSOR_ROUTES.every((route) => stored[route] !== null)) {
    return yield* requireConsistentPredecessorRows(stored);
  }
  const pair = yield* requirePredecessorPair(stored);
  const expandedAt = yield* Clock.currentTimeMillis;
  const reopened = pair.singular.phase === "sealed";
  const base = {
    activeManifestHash: pair.singular.activeManifestHash,
    activeReleaseId: pair.singular.activeReleaseId,
    activeSequence: pair.singular.activeSequence,
    armedAt: pair.singular.armedAt,
    deploymentName: pair.singular.deploymentName,
    invocationCount: 0,
    observationId: pair.singular.observationId,
    phase: "armed" as const,
    quietSince: expandedAt,
  };
  if (reopened) {
    yield* Effect.forEach([pair.singular, pair.batch], (row) =>
      Effect.promise(() =>
        ctx.db.patch("contentPredecessorReads", row._id, {
          phase: "armed",
          quietSince: expandedAt,
          sealedAt: undefined,
        })
      )
    );
  }
  yield* Effect.promise(() =>
    ctx.db.insert("contentPredecessorReads", {
      ...base,
      route: "protected",
    })
  );
  yield* Effect.promise(() =>
    ctx.db.insert("contentPredecessorReads", {
      ...base,
      route: "history",
    })
  );
  return yield* requireConsistentPredecessorRows(
    yield* loadPredecessorRows(ctx)
  );
});

/** Rejects every partial or internally conflicting observation row set. */
export const requireConsistentPredecessorRows = Effect.fn(
  "contentRelease.predecessor.requireRows"
)(function* (rows: StoredPredecessorRows) {
  const { batch, history, protected: protectedRoute, singular } = rows;
  if (!(singular && batch && protectedRoute && history)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      "Predecessor observation is not armed for every route."
    );
  }
  const complete = {
    batch,
    history,
    protected: protectedRoute,
    singular,
  } satisfies PredecessorRows;
  for (const route of PREDECESSOR_ROUTES) {
    const row = complete[route];
    if (
      singular.observationId !== row.observationId ||
      singular.activeManifestHash !== row.activeManifestHash ||
      singular.activeReleaseId !== row.activeReleaseId ||
      singular.activeSequence !== row.activeSequence ||
      singular.armedAt !== row.armedAt ||
      singular.deploymentName !== row.deploymentName ||
      singular.phase !== row.phase
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Predecessor route observations do not share one identity."
      );
    }
  }
  return complete;
});

/** Requires every row to belong to the requested observation. */
export const requireOwnedPredecessorRows = Effect.fn(
  "contentRelease.predecessor.requireOwnedRows"
)(function* (
  rows: StoredPredecessorRows,
  observationId: PredecessorObservationId
) {
  const complete = yield* requireConsistentPredecessorRows(rows);
  if (complete.singular.observationId !== observationId) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      "Predecessor observation ID does not own every route."
    );
  }
  return complete;
});

/** Deletes exactly one complete observation in the current transaction. */
export const deletePredecessorRows = Effect.fn(
  "contentRelease.predecessor.deleteRows"
)(function* (ctx: MutationCtx, rows: PredecessorRows) {
  yield* Effect.forEach(PREDECESSOR_ROUTES, (route) =>
    Effect.promise(() =>
      ctx.db.delete("contentPredecessorReads", rows[route]._id)
    )
  );
});
