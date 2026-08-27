import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadState } from "@repo/backend/convex/contentRelease/model";
import type {
  PredecessorFields,
  PredecessorReadCtx,
  PredecessorRows,
} from "@repo/backend/convex/contentRelease/predecessor/rows";
import type { PredecessorIdentity } from "@repo/backend/convex/contentRelease/predecessor/spec";
import { Effect } from "effect";

/** Requires one complete active identity from the singleton state. */
export const loadActivePredecessorIdentity = Effect.fn(
  "contentRelease.predecessor.loadActiveIdentity"
)(function* (ctx: PredecessorReadCtx) {
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
export const loadPredecessorDeployment = Effect.fn(
  "contentRelease.predecessor.loadDeployment"
)(function* (ctx: PredecessorReadCtx) {
  const deployment = yield* Effect.promise(() =>
    ctx.meta.getDeploymentMetadata()
  );
  return deployment.name;
});

/** Returns the release identity durably owned by one consistent observation. */
export function storedPredecessorIdentity(
  rows: PredecessorFields
): PredecessorIdentity {
  return {
    manifestHash: rows.singular.activeManifestHash,
    releaseId: rows.singular.activeReleaseId,
    sequence: rows.singular.activeSequence,
  };
}

/** Compares one consistent observation with the live release identity. */
export function hasActivePredecessorIdentity(
  rows: PredecessorFields,
  active: PredecessorIdentity
) {
  const stored = storedPredecessorIdentity(rows);
  return (
    stored.manifestHash === active.manifestHash &&
    stored.releaseId === active.releaseId &&
    stored.sequence === active.sequence
  );
}

/** Rejects reuse of a quiet window after the active release changes. */
export const requireActivePredecessorIdentity = Effect.fn(
  "contentRelease.predecessor.requireActiveIdentity"
)(function* (rows: PredecessorRows, active: PredecessorIdentity) {
  if (!hasActivePredecessorIdentity(rows, active)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      "Active release changed during predecessor observation."
    );
  }
});

/** Verifies every row belongs to the executing deployment. */
export const requirePredecessorDeployment = Effect.fn(
  "contentRelease.predecessor.requireDeployment"
)(function* (rows: PredecessorRows, deploymentName: string) {
  if (
    Object.values(rows).some((row) => row.deploymentName !== deploymentName)
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      "Predecessor observation belongs to another deployment."
    );
  }
});
