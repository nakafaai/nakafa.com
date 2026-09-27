import { DatabaseReader } from "@confect/server";
import type { ContentSnapshotKind } from "@nakafa/aksara-contracts/release/snapshot/scope";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  loadRelease,
  loadState,
} from "@repo/backend/confect/contentRelease/model";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { Effect, Option } from "effect";

/** Checks permanent try-out state that still requires one snapshot. */
const hasTryoutRuntimeReference = Effect.fn(
  "contentRelease.hasTryoutRuntimeReference"
)(function* (ctx: MutationCtx, snapshotId: string) {
  const database = DatabaseReader.make(databaseSchema, ctx.db);
  const [attempt, scale] = yield* Effect.all([
    database
      .table("tryoutAttempts")
      .index("by_tryoutSnapshotId", (query) =>
        query.eq("tryoutSnapshotId", snapshotId)
      )
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie),
    database
      .table("irtScaleVersions")
      .index(
        "by_tryoutSnapshotId_and_setIdentity_and_history_and_publishedAt",
        (query) => query.eq("tryoutSnapshotId", snapshotId)
      )
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie),
  ]);
  return attempt !== null || scale !== null;
});

/** Collects every release ID whose stored history must stay reachable. */
const protectedReleases = Effect.fn("contentRelease.protectedSnapshotReleases")(
  function* (ctx: MutationCtx) {
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    const state = yield* loadState(ctx);
    const completed = yield* database
      .table("contentReleases")
      .index(
        "by_status_and_sequence",
        (query) => query.eq("status", "completed"),
        "desc"
      )
      .take(2)
      .pipe(Effect.orDie);
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
      const baseReleaseId = release.baseReleaseId;
      if (baseReleaseId !== null) {
        ids.add(baseReleaseId);
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
  if (
    family === "tryout" &&
    (yield* hasTryoutRuntimeReference(ctx, snapshotId))
  ) {
    return true;
  }
  const ids = yield* protectedReleases(ctx);
  for (const releaseId of ids) {
    const release = yield* loadRelease(ctx, releaseId);
    const state = release.snapshotTransitions[family];
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
  const database = DatabaseReader.make(databaseSchema, ctx.db);
  const [question, answer] = yield* Effect.all([
    database
      .table("tryoutPlacements")
      .index("by_questionArtifactHash", (query) =>
        query.eq("questionArtifactHash", artifactHash)
      )
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie),
    database
      .table("tryoutPlacements")
      .index("by_answerArtifactHash", (query) =>
        query.eq("answerArtifactHash", artifactHash)
      )
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie),
  ]);
  return question !== null || answer !== null;
});
