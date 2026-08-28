import type { ContentSnapshotKind } from "@nakafa/aksara-contracts/release/snapshot/scope";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  loadRelease,
  loadState,
} from "@repo/backend/convex/contentRelease/model";
import { decodeReleaseJson } from "@repo/backend/convex/contentRelease/parse";
import { Effect } from "effect";

/** Checks indexed transaction history that still requires one try-out snapshot. */
const hasTryoutRuntimeReference = Effect.fn(
  "contentRelease.hasTryoutRuntimeReference"
)(function* (
  ctx: MutationCtx,
  snapshotId: string,
  ignoredScaleVersionIds: readonly Id<"irtScaleVersions">[],
  ignoredMigrationId: string | undefined
) {
  const ignoredScales = new Set(ignoredScaleVersionIds);
  const [attempt, sources, targets, scales] = yield* Effect.all([
    Effect.promise(() =>
      ctx.db
        .query("tryoutAttempts")
        .withIndex("by_tryoutSnapshotId", (query) =>
          query.eq("tryoutSnapshotId", snapshotId)
        )
        .first()
    ),
    Effect.promise(() =>
      ctx.db
        .query("tryoutHistoryMigrations")
        .withIndex("by_source_snapshotId", (query) =>
          query.eq("sourceSnapshotId", snapshotId)
        )
        .take(2)
    ),
    Effect.promise(() =>
      ctx.db
        .query("tryoutHistoryMigrations")
        .withIndex("by_target_snapshotId", (query) =>
          query.eq("target.snapshotId", snapshotId)
        )
        .take(2)
    ),
    Effect.promise(() =>
      ctx.db
        .query("irtScaleVersions")
        .withIndex(
          "by_tryoutSnapshotId_and_setIdentity_and_publishedAt",
          (query) => query.eq("tryoutSnapshotId", snapshotId)
        )
        .take(ignoredScales.size + 1)
    ),
  ]);
  return (
    attempt !== null ||
    sources.some(({ migrationId }) => migrationId !== ignoredMigrationId) ||
    targets.some(({ migrationId }) => migrationId !== ignoredMigrationId) ||
    scales.some(({ _id }) => !ignoredScales.has(_id))
  );
});

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
  snapshotId: string,
  options?: {
    readonly ignoredMigrationId?: string;
    readonly ignoredScaleVersionIds?: readonly Id<"irtScaleVersions">[];
  }
) {
  if (
    family === "tryout" &&
    (yield* hasTryoutRuntimeReference(
      ctx,
      snapshotId,
      options?.ignoredScaleVersionIds ?? [],
      options?.ignoredMigrationId
    ))
  ) {
    return true;
  }
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

/** Checks the sole live migration's source and target artifact ledger. */
const hasMigrationArtifactReference = Effect.fn(
  "contentRelease.hasMigrationArtifactReference"
)(function* (
  ctx: MutationCtx,
  artifactHash: string,
  ignoredMigrationId: string | undefined
) {
  const migrations = yield* Effect.promise(() =>
    ctx.db.query("tryoutHistoryMigrations").take(2)
  );
  if (migrations.length > 1) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "More than one try-out history migration owns artifact retention."
    );
  }
  const migration = migrations[0];
  if (!migration || migration.migrationId === ignoredMigrationId) {
    return false;
  }
  const [source, target] = yield* Effect.all([
    Effect.promise(() =>
      ctx.db
        .query("tryoutHistoryMigrationMaps")
        .withIndex("by_migrationId_and_kind_and_oldHash", (query) =>
          query
            .eq("migrationId", migration.migrationId)
            .eq("kind", "artifact")
            .eq("oldHash", artifactHash)
        )
        .unique()
    ),
    Effect.promise(() =>
      ctx.db
        .query("tryoutHistoryMigrationMaps")
        .withIndex("by_migrationId_and_kind_and_newHash", (query) =>
          query
            .eq("migrationId", migration.migrationId)
            .eq("kind", "artifact")
            .eq("newHash", artifactHash)
        )
        .first()
    ),
  ]);
  return source !== null || target !== null;
});

/** Checks whether any immutable try-out placement owns an artifact. */
export const hasSnapshotArtifactReference = Effect.fn(
  "contentRelease.hasSnapshotArtifactReference"
)(function* (
  ctx: MutationCtx,
  artifactHash: string,
  options?: { readonly ignoredMigrationId?: string }
) {
  const [question, answer, retainedQuestion, retainedAnswer, migration] =
    yield* Effect.all([
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
      Effect.promise(() =>
        ctx.db
          .query("tryoutHistoryRows")
          .withIndex("by_questionArtifactHash", (query) =>
            query.eq("questionArtifactHash", artifactHash)
          )
          .first()
      ),
      Effect.promise(() =>
        ctx.db
          .query("tryoutHistoryRows")
          .withIndex("by_answerArtifactHash", (query) =>
            query.eq("answerArtifactHash", artifactHash)
          )
          .first()
      ),
      hasMigrationArtifactReference(
        ctx,
        artifactHash,
        options?.ignoredMigrationId
      ),
    ]);
  return (
    question !== null ||
    answer !== null ||
    retainedQuestion !== null ||
    retainedAnswer !== null ||
    migration
  );
});
