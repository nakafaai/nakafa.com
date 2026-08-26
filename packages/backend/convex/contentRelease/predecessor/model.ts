import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadState } from "@repo/backend/convex/contentRelease/model";
import {
  decodePredecessorObservationId,
  PREDECESSOR_QUIET_WINDOW_MS,
  type PredecessorClearReceipt,
  type PredecessorIdentity,
  type PredecessorObservationId,
  type PredecessorRecordResult,
  type PredecessorRoute,
  type PredecessorStatus,
} from "@repo/backend/convex/contentRelease/predecessor/spec";
import { Clock, Effect } from "effect";

type ReadCtx = MutationCtx | QueryCtx;
type PredecessorRead = Doc<"contentPredecessorReads">;
type PredecessorReadFields = Omit<PredecessorRead, "_creationTime" | "_id">;
interface StoredRows {
  readonly batch: PredecessorRead | null;
  readonly singular: PredecessorRead | null;
}
interface ObservationFields {
  readonly batch: PredecessorReadFields;
  readonly singular: PredecessorReadFields;
}
interface ObservationRows {
  readonly batch: PredecessorRead;
  readonly singular: PredecessorRead;
}

/** Reads one route through its exact bounded index and rejects duplicates. */
const loadRoute = Effect.fn("contentRelease.predecessor.loadRoute")(function* (
  ctx: ReadCtx,
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

/** Reads both route rows without scanning the temporary table. */
const loadRoutes = Effect.fn("contentRelease.predecessor.loadRoutes")(
  function* (ctx: ReadCtx) {
    const [singular, batch] = yield* Effect.all(
      [loadRoute(ctx, "singular"), loadRoute(ctx, "batch")],
      { concurrency: "unbounded" }
    );
    return { batch, singular } satisfies StoredRows;
  }
);

/** Requires one complete active identity from the singleton state. */
const loadActiveIdentity = Effect.fn(
  "contentRelease.predecessor.loadActiveIdentity"
)(function* (ctx: ReadCtx) {
  const state = yield* loadState(ctx);
  if (
    !(state?.activeManifestHash && state.activeReleaseId) ||
    state.activeSequence === undefined
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      "Predecessor observation requires one complete active release."
    );
  }
  return {
    manifestHash: state.activeManifestHash,
    releaseId: state.activeReleaseId,
    sequence: state.activeSequence,
  } satisfies PredecessorIdentity;
});

/** Reads the server-verified Convex deployment name. */
const loadDeploymentName = Effect.fn(
  "contentRelease.predecessor.loadDeploymentName"
)(function* (ctx: ReadCtx) {
  const deployment = yield* Effect.promise(() =>
    ctx.meta.getDeploymentMetadata()
  );
  return deployment.name;
});

/** Rejects every partial or internally conflicting observation row set. */
const requireConsistentRows = Effect.fn(
  "contentRelease.predecessor.requireConsistentRows"
)(function* (rows: StoredRows) {
  if (!(rows.singular && rows.batch)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      "Predecessor observation is not armed for both routes."
    );
  }
  const { singular, batch } = rows;
  if (
    singular.observationId !== batch.observationId ||
    singular.activeManifestHash !== batch.activeManifestHash ||
    singular.activeReleaseId !== batch.activeReleaseId ||
    singular.activeSequence !== batch.activeSequence ||
    singular.armedAt !== batch.armedAt ||
    singular.deploymentName !== batch.deploymentName ||
    singular.phase !== batch.phase
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Predecessor route observations do not share one identity."
    );
  }
  return { batch, singular } satisfies ObservationRows;
});

/** Requires both rows to belong to the requested observation. */
const requireOwnedRows = Effect.fn(
  "contentRelease.predecessor.requireOwnedRows"
)(function* (rows: StoredRows, observationId: PredecessorObservationId) {
  const complete = yield* requireConsistentRows(rows);
  if (complete.singular.observationId !== observationId) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      "Predecessor observation ID does not own both routes."
    );
  }
  return complete;
});

/** Returns the release identity durably owned by one consistent pair. */
function storedIdentity(rows: ObservationFields): PredecessorIdentity {
  return {
    manifestHash: rows.singular.activeManifestHash,
    releaseId: rows.singular.activeReleaseId,
    sequence: rows.singular.activeSequence,
  };
}

/** Compares one consistent stored pair with the live release identity. */
function hasActiveIdentity(
  rows: ObservationFields,
  active: PredecessorIdentity
) {
  const stored = storedIdentity(rows);
  return (
    stored.manifestHash === active.manifestHash &&
    stored.releaseId === active.releaseId &&
    stored.sequence === active.sequence
  );
}

/** Rejects reuse of a quiet window after the active release changes. */
const requireActiveIdentity = Effect.fn(
  "contentRelease.predecessor.requireActiveIdentity"
)(function* (rows: ObservationRows, active: PredecessorIdentity) {
  if (!hasActiveIdentity(rows, active)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      "Active release changed during predecessor observation."
    );
  }
});

/** Verifies both rows belong to the executing deployment. */
const requireDeployment = Effect.fn(
  "contentRelease.predecessor.requireDeployment"
)(function* (rows: ObservationRows, deploymentName: string) {
  if (
    rows.singular.deploymentName !== deploymentName ||
    rows.batch.deploymentName !== deploymentName
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      "Predecessor observation belongs to another deployment."
    );
  }
});

/** Loads one owned observation plus its live release identity. */
const loadObservation = Effect.fn("contentRelease.predecessor.loadObservation")(
  function* (ctx: ReadCtx, rawObservationId: string) {
    const observationId =
      yield* decodePredecessorObservationId(rawObservationId);
    const rows = yield* requireOwnedRows(yield* loadRoutes(ctx), observationId);
    yield* requireDeployment(rows, yield* loadDeploymentName(ctx));
    const active = yield* loadActiveIdentity(ctx);
    return { active, rows };
  }
);

/** Builds route evidence only from durable observation rows. */
function buildRoutes(rows: ObservationFields) {
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
    singular: routeStatus(rows.singular),
  };
}

/** Builds status without deriving time from a cacheable query execution. */
function buildStatus(
  rows: ObservationFields,
  active: PredecessorIdentity
): PredecessorStatus {
  const common = {
    deploymentName: rows.singular.deploymentName,
    observationId: rows.singular.observationId,
    routes: buildRoutes(rows),
  };
  if (hasActiveIdentity(rows, active)) {
    return { ...common, active, kind: "active" };
  }
  return {
    ...common,
    kind: "drifted",
    live: active,
    stored: storedIdentity(rows),
  };
}

/** Creates both route rows atomically for one exact active release. */
export const armPredecessorObservation = Effect.fn(
  "contentRelease.predecessor.arm"
)(function* (ctx: MutationCtx, rawObservationId: string) {
  const observationId = yield* decodePredecessorObservationId(rawObservationId);
  const existing = yield* loadRoutes(ctx);
  if (existing.singular || existing.batch) {
    const rows = yield* requireOwnedRows(existing, observationId);
    yield* requireDeployment(rows, yield* loadDeploymentName(ctx));
    return buildStatus(rows, yield* loadActiveIdentity(ctx));
  }
  const active = yield* loadActiveIdentity(ctx);
  const deploymentName = yield* loadDeploymentName(ctx);
  const armedAt = yield* Clock.currentTimeMillis;
  const base = {
    activeManifestHash: active.manifestHash,
    activeReleaseId: active.releaseId,
    activeSequence: active.sequence,
    armedAt,
    deploymentName,
    invocationCount: 0,
    observationId,
    phase: "armed" as const,
    quietSince: armedAt,
  };
  const singular = { ...base, route: "singular" as const };
  const batch = { ...base, route: "batch" as const };
  yield* Effect.promise(() =>
    ctx.db.insert("contentPredecessorReads", singular)
  );
  yield* Effect.promise(() => ctx.db.insert("contentPredecessorReads", batch));
  return buildStatus({ batch, singular }, active);
});

/** Reads exact observation status without changing its quiet clock. */
export const readPredecessorObservation = Effect.fn(
  "contentRelease.predecessor.status"
)(function* (ctx: ReadCtx, observationId: string) {
  const observation = yield* loadObservation(ctx, observationId);
  return buildStatus(observation.rows, observation.active);
});

/**
 * Records one authenticated predecessor call before content dispatch.
 *
 * Both rows are read deliberately. Convex OCC therefore serializes unexpected
 * cross-route traffic, preserving the fail-closed pair invariant. This
 * temporary observer expects zero traffic, so correctness owns the tradeoff.
 * A late read reopens both sealed rows atomically and restarts that route's
 * quiet clock. Release drift returns both identities without writing, which
 * keeps the predecessor route available while clear owns abandonment.
 */
export const recordPredecessorRead = Effect.fn(
  "contentRelease.predecessor.record"
)(function* (ctx: MutationCtx, route: PredecessorRoute) {
  const stored = yield* loadRoutes(ctx);
  if (!(stored.singular || stored.batch)) {
    return { kind: "inactive" } satisfies PredecessorRecordResult;
  }
  const rows = yield* requireConsistentRows(stored);
  yield* requireDeployment(rows, yield* loadDeploymentName(ctx));
  const active = yield* loadActiveIdentity(ctx);
  if (!hasActiveIdentity(rows, active)) {
    return {
      kind: "drifted",
      live: active,
      stored: storedIdentity(rows),
    } satisfies PredecessorRecordResult;
  }
  const row = rows[route];
  if (row.invocationCount >= Number.MAX_SAFE_INTEGER) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Predecessor ${route} invocation count exceeded its safe bound.`
    );
  }
  const now = yield* Clock.currentTimeMillis;
  if (rows.singular.phase === "sealed") {
    const other = route === "singular" ? rows.batch : rows.singular;
    yield* Effect.promise(() =>
      ctx.db.patch("contentPredecessorReads", row._id, {
        invocationCount: row.invocationCount + 1,
        lastInvokedAt: now,
        phase: "armed",
        quietSince: now,
        sealedAt: undefined,
      })
    );
    yield* Effect.promise(() =>
      ctx.db.patch("contentPredecessorReads", other._id, {
        phase: "armed",
        sealedAt: undefined,
      })
    );
    return { kind: "recorded" } satisfies PredecessorRecordResult;
  }
  yield* Effect.promise(() =>
    ctx.db.patch("contentPredecessorReads", row._id, {
      invocationCount: row.invocationCount + 1,
      lastInvokedAt: now,
      quietSince: now,
    })
  );
  return { kind: "recorded" } satisfies PredecessorRecordResult;
});

/** Seals both routes only after their quiet windows remain intact. */
export const sealPredecessorObservation = Effect.fn(
  "contentRelease.predecessor.seal"
)(function* (ctx: MutationCtx, observationId: string) {
  const observation = yield* loadObservation(ctx, observationId);
  const { active, rows } = observation;
  yield* requireActiveIdentity(rows, active);
  if (rows.singular.phase !== "armed") {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      "Predecessor observation is already sealed."
    );
  }
  const now = yield* Clock.currentTimeMillis;
  if (
    now - rows.singular.quietSince < PREDECESSOR_QUIET_WINDOW_MS ||
    now - rows.batch.quietSince < PREDECESSOR_QUIET_WINDOW_MS
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      "Predecessor observation has not completed its quiet window."
    );
  }
  yield* Effect.promise(() =>
    ctx.db.patch("contentPredecessorReads", rows.singular._id, {
      phase: "sealed",
      sealedAt: now,
    })
  );
  yield* Effect.promise(() =>
    ctx.db.patch("contentPredecessorReads", rows.batch._id, {
      phase: "sealed",
      sealedAt: now,
    })
  );
  return buildStatus(
    {
      batch: { ...rows.batch, phase: "sealed", sealedAt: now },
      singular: { ...rows.singular, phase: "sealed", sealedAt: now },
    },
    active
  );
});

/** Deletes exactly one complete observation pair in the current transaction. */
const deleteObservation = Effect.fn(
  "contentRelease.predecessor.deleteObservation"
)(function* (ctx: MutationCtx, rows: ObservationRows) {
  yield* Effect.promise(() =>
    ctx.db.delete("contentPredecessorReads", rows.singular._id)
  );
  yield* Effect.promise(() =>
    ctx.db.delete("contentPredecessorReads", rows.batch._id)
  );
});

/** Deletes one sealed observation or abandons one invalidated by drift. */
export const clearPredecessorObservation = Effect.fn(
  "contentRelease.predecessor.clear"
)(function* (ctx: MutationCtx, rawObservationId: string) {
  const observation = yield* loadObservation(ctx, rawObservationId);
  const { active, rows } = observation;
  if (!hasActiveIdentity(rows, active)) {
    const abandonedAt = yield* Clock.currentTimeMillis;
    yield* deleteObservation(ctx, rows);
    return {
      abandonedAt,
      deleted: 2,
      deploymentName: rows.singular.deploymentName,
      kind: "abandoned",
      live: active,
      observationId: rows.singular.observationId,
      routes: buildRoutes(rows),
      stored: storedIdentity(rows),
    } satisfies PredecessorClearReceipt;
  }
  const singularSealedAt = rows.singular.sealedAt;
  const batchSealedAt = rows.batch.sealedAt;
  if (
    rows.singular.phase !== "sealed" ||
    singularSealedAt === undefined ||
    batchSealedAt === undefined
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      "Only an exact sealed predecessor observation can be cleared."
    );
  }
  const clearedAt = yield* Clock.currentTimeMillis;
  yield* deleteObservation(ctx, rows);
  return {
    active,
    clearedAt,
    deleted: 2,
    deploymentName: rows.singular.deploymentName,
    kind: "cleared",
    observationId: rows.singular.observationId,
    routes: {
      batch: {
        armedAt: rows.batch.armedAt,
        invocationCount: rows.batch.invocationCount,
        ...(rows.batch.lastInvokedAt === undefined
          ? {}
          : { lastInvokedAt: rows.batch.lastInvokedAt }),
        phase: "sealed" as const,
        quietSince: rows.batch.quietSince,
        route: rows.batch.route,
        sealedAt: batchSealedAt,
      },
      singular: {
        armedAt: rows.singular.armedAt,
        invocationCount: rows.singular.invocationCount,
        ...(rows.singular.lastInvokedAt === undefined
          ? {}
          : { lastInvokedAt: rows.singular.lastInvokedAt }),
        phase: "sealed" as const,
        quietSince: rows.singular.quietSince,
        route: rows.singular.route,
        sealedAt: singularSealedAt,
      },
    },
  } satisfies PredecessorClearReceipt;
});
