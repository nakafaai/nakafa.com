import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  hasActivePredecessorIdentity,
  loadActivePredecessorIdentity,
  loadPredecessorDeployment,
  requireActivePredecessorIdentity,
  requirePredecessorDeployment,
  storedPredecessorIdentity,
} from "@repo/backend/convex/contentRelease/predecessor/identity";
import {
  deletePredecessorRows,
  expandPredecessorRows,
  loadPredecessorRows,
  requireConsistentPredecessorRows,
  requireOwnedPredecessorRows,
} from "@repo/backend/convex/contentRelease/predecessor/rows";
import {
  decodePredecessorObservationId,
  PREDECESSOR_QUIET_WINDOW_MS,
  PREDECESSOR_ROUTES,
  type PredecessorAbandonReceipt,
} from "@repo/backend/convex/contentRelease/predecessor/spec";
import { buildPredecessorStatus } from "@repo/backend/convex/contentRelease/predecessor/status";
import { Clock, Effect } from "effect";

type ReadCtx = MutationCtx | QueryCtx;

/** Loads one owned observation plus its live release identity. */
const loadObservation = Effect.fn("contentRelease.predecessor.loadObservation")(
  function* (ctx: ReadCtx, rawObservationId: string) {
    const observationId =
      yield* decodePredecessorObservationId(rawObservationId);
    const rows = yield* requireOwnedPredecessorRows(
      yield* loadPredecessorRows(ctx),
      observationId
    );
    yield* requirePredecessorDeployment(
      rows,
      yield* loadPredecessorDeployment(ctx)
    );
    const active = yield* loadActivePredecessorIdentity(ctx);
    return { active, rows };
  }
);

/** Expands and loads one observation for mutation-owned control operations. */
const loadMutableObservation = Effect.fn(
  "contentRelease.predecessor.loadMutableObservation"
)(function* (ctx: MutationCtx, rawObservationId: string) {
  const observationId = yield* decodePredecessorObservationId(rawObservationId);
  const rows = yield* requireOwnedPredecessorRows(
    yield* expandPredecessorRows(ctx, yield* loadPredecessorRows(ctx)),
    observationId
  );
  yield* requirePredecessorDeployment(
    rows,
    yield* loadPredecessorDeployment(ctx)
  );
  const active = yield* loadActivePredecessorIdentity(ctx);
  return { active, rows };
});

/** Requires the live deployment's complete predecessor window to be sealed. */
export const requireSealedPredecessorObservation = Effect.fn(
  "contentRelease.predecessor.requireSealed"
)(function* (ctx: ReadCtx, expectedObservationId?: string) {
  const rows = yield* requireConsistentPredecessorRows(
    yield* loadPredecessorRows(ctx)
  );
  yield* requirePredecessorDeployment(
    rows,
    yield* loadPredecessorDeployment(ctx)
  );
  yield* requireActivePredecessorIdentity(
    rows,
    yield* loadActivePredecessorIdentity(ctx)
  );
  if (
    PREDECESSOR_ROUTES.some(
      (route) =>
        rows[route].phase !== "sealed" || rows[route].sealedAt === undefined
    )
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      "Every predecessor route must complete its observation window before migration."
    );
  }
  const observationId = yield* decodePredecessorObservationId(
    rows.singular.observationId
  );
  if (
    expectedObservationId !== undefined &&
    observationId !==
      (yield* decodePredecessorObservationId(expectedObservationId))
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      "Predecessor observation ID changed during migration."
    );
  }
  return observationId;
});

/** Requires every predecessor route to remain unused for immediate retirement. */
export const requireUnusedPredecessorObservation = Effect.fn(
  "contentRelease.predecessor.requireUnused"
)(function* (ctx: ReadCtx, expectedObservationId?: string) {
  const rows = yield* requireConsistentPredecessorRows(
    yield* loadPredecessorRows(ctx)
  );
  yield* requirePredecessorDeployment(
    rows,
    yield* loadPredecessorDeployment(ctx)
  );
  yield* requireActivePredecessorIdentity(
    rows,
    yield* loadActivePredecessorIdentity(ctx)
  );
  if (
    PREDECESSOR_ROUTES.some((route) => {
      const row = rows[route];
      return (
        row.invocationCount !== 0 ||
        row.lastInvokedAt !== undefined ||
        row.quietSince !== row.armedAt
      );
    })
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      "A predecessor route was invoked after observation began."
    );
  }
  const observationId = yield* decodePredecessorObservationId(
    rows.singular.observationId
  );
  if (
    expectedObservationId !== undefined &&
    observationId !==
      (yield* decodePredecessorObservationId(expectedObservationId))
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      "Predecessor observation ID changed during migration."
    );
  }
  return observationId;
});

/** Creates every route row atomically for one exact active release. */
export const armPredecessorObservation = Effect.fn(
  "contentRelease.predecessor.arm"
)(function* (ctx: MutationCtx, rawObservationId: string) {
  const observationId = yield* decodePredecessorObservationId(rawObservationId);
  const existing = yield* loadPredecessorRows(ctx);
  if (PREDECESSOR_ROUTES.some((route) => existing[route] !== null)) {
    const rows = yield* requireOwnedPredecessorRows(
      yield* expandPredecessorRows(ctx, existing),
      observationId
    );
    yield* requirePredecessorDeployment(
      rows,
      yield* loadPredecessorDeployment(ctx)
    );
    return buildPredecessorStatus(
      rows,
      yield* loadActivePredecessorIdentity(ctx)
    );
  }
  const active = yield* loadActivePredecessorIdentity(ctx);
  const deploymentName = yield* loadPredecessorDeployment(ctx);
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
  const rows = {
    batch: { ...base, route: "batch" as const },
    history: { ...base, route: "history" as const },
    protected: { ...base, route: "protected" as const },
    singular: { ...base, route: "singular" as const },
  };
  yield* Effect.forEach(PREDECESSOR_ROUTES, (route) =>
    Effect.promise(() => ctx.db.insert("contentPredecessorReads", rows[route]))
  );
  return buildPredecessorStatus(rows, active);
});

/** Reads exact observation status without changing its quiet clock. */
export const readPredecessorObservation = Effect.fn(
  "contentRelease.predecessor.status"
)(function* (ctx: ReadCtx, observationId: string) {
  const observation = yield* loadObservation(ctx, observationId);
  return buildPredecessorStatus(observation.rows, observation.active);
});

/** Seals every route only after its quiet window remains intact. */
export const sealPredecessorObservation = Effect.fn(
  "contentRelease.predecessor.seal"
)(function* (ctx: MutationCtx, observationId: string) {
  const { active, rows } = yield* loadMutableObservation(ctx, observationId);
  yield* requireActivePredecessorIdentity(rows, active);
  if (rows.singular.phase !== "armed") {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      "Predecessor observation is already sealed."
    );
  }
  const now = yield* Clock.currentTimeMillis;
  if (
    PREDECESSOR_ROUTES.some(
      (route) => now - rows[route].quietSince < PREDECESSOR_QUIET_WINDOW_MS
    )
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      "Predecessor observation has not completed its quiet window."
    );
  }
  yield* Effect.forEach(PREDECESSOR_ROUTES, (route) =>
    Effect.promise(() =>
      ctx.db.patch("contentPredecessorReads", rows[route]._id, {
        phase: "sealed",
        sealedAt: now,
      })
    )
  );
  return buildPredecessorStatus(
    {
      batch: { ...rows.batch, phase: "sealed", sealedAt: now },
      history: { ...rows.history, phase: "sealed", sealedAt: now },
      protected: { ...rows.protected, phase: "sealed", sealedAt: now },
      singular: { ...rows.singular, phase: "sealed", sealedAt: now },
    },
    active
  );
});

/** Deletes one exact observation only after its active release has drifted. */
export const abandonPredecessorObservation = Effect.fn(
  "contentRelease.predecessor.abandon"
)(function* (ctx: MutationCtx, rawObservationId: string) {
  const { active, rows } = yield* loadMutableObservation(ctx, rawObservationId);
  if (hasActivePredecessorIdentity(rows, active)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      "An active predecessor observation cannot be abandoned."
    );
  }
  const abandonedAt = yield* Clock.currentTimeMillis;
  yield* deletePredecessorRows(ctx, rows);
  return {
    abandonedAt,
    deleted: 4,
    deploymentName: rows.singular.deploymentName,
    kind: "abandoned",
    live: active,
    observationId: rows.singular.observationId,
    routes: buildPredecessorStatus(rows, active).routes,
    stored: storedPredecessorIdentity(rows),
  } satisfies PredecessorAbandonReceipt;
});
