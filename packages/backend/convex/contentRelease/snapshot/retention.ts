import type { ContentSnapshotKind } from "@nakafa/aksara-contracts/release/snapshot";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  loadRelease,
  loadState,
} from "@repo/backend/convex/contentRelease/model";
import { decodeReleaseJson } from "@repo/backend/convex/contentRelease/parse";
import { Effect } from "effect";

/** Collects release IDs directly protected by publication slots and history. */
const protectedReleases = Effect.fn("contentRelease.protectedSnapshotReleases")(
  function* (ctx: MutationCtx) {
    const state = yield* loadState(ctx);
    const completed = yield* Effect.promise(() =>
      ctx.db
        .query("contentReleases")
        .withIndex("by_status_and_sequence", (query) =>
          query.eq("status", "completed")
        )
        .order("desc")
        .take(2)
    );
    const ids = new Set(
      [
        state?.activeReleaseId,
        state?.candidateReleaseId,
        state?.recoveryReleaseId,
        ...completed.map(({ releaseId }) => releaseId),
      ].filter((releaseId) => releaseId !== undefined)
    );
    for (const releaseId of [...ids]) {
      const release = yield* loadRelease(ctx, releaseId);
      const signed = yield* decodeReleaseJson(release.releaseJson);
      if (signed.manifest.baseReleaseId !== null) {
        ids.add(signed.manifest.baseReleaseId);
      }
    }
    return ids;
  }
);

/** Checks whether any retained release still selects one immutable snapshot. */
export const isSnapshotReferenced = Effect.fn(
  "contentRelease.isSnapshotReferenced"
)(function* (
  ctx: MutationCtx,
  family: ContentSnapshotKind,
  snapshotId: string
) {
  const releaseIds = yield* protectedReleases(ctx);
  for (const releaseId of releaseIds) {
    const release = yield* loadRelease(ctx, releaseId);
    const signed = yield* decodeReleaseJson(release.releaseJson);
    const state = signed.manifest.snapshots[family];
    if (
      state.baseSnapshotId === snapshotId ||
      state.resultSnapshotId === snapshotId
    ) {
      return true;
    }
  }
  return false;
});

/** Checks whether any immutable try-out placement owns an artifact. */
export const hasSnapshotArtifactReference = Effect.fn(
  "contentRelease.hasSnapshotArtifactReference"
)(function* (ctx: MutationCtx, artifactHash: string) {
  const [question, answer] = yield* Effect.all([
    Effect.promise(() =>
      ctx.db
        .query("tryoutPlacements")
        .withIndex("by_questionArtifactHash", (query) =>
          query.eq("questionArtifactHash", artifactHash)
        )
        .first()
    ),
    Effect.promise(() =>
      ctx.db
        .query("tryoutPlacements")
        .withIndex("by_answerArtifactHash", (query) =>
          query.eq("answerArtifactHash", artifactHash)
        )
        .first()
    ),
  ]);
  return question !== null || answer !== null;
});
