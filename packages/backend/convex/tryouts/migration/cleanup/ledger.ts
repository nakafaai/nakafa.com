import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { isArtifactReferenced } from "@repo/backend/convex/contentRelease/retention";
import type { CleanupPage } from "@repo/backend/convex/tryouts/migration/cleanup/schema";
import { Effect } from "effect";

const MAP_PAGE_COUNT = 32;
const ARTIFACT_PAGE_COUNT = 8;

/** Deletes mapped source artifacts only after every source row is gone. */
const cleanupArtifacts = Effect.fn("tryouts.migration.cleanupArtifacts")(
  function* (ctx: MutationCtx, migrationId: string) {
    const mappings = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutHistoryMigrationMaps")
        .withIndex("by_migrationId_and_kind_and_index", (query) =>
          query.eq("migrationId", migrationId).eq("kind", "artifact")
        )
        .take(ARTIFACT_PAGE_COUNT)
    );
    let deleted = 0;
    for (const mapping of mappings) {
      if (
        mapping.oldHash !== mapping.newHash &&
        !(yield* isArtifactReferenced(ctx, mapping.oldHash, {
          ignoredMigrationId: migrationId,
        }))
      ) {
        const artifact = yield* Effect.promise(() =>
          ctx.db
            .query("contentArtifacts")
            .withIndex("by_artifactHash", (query) =>
              query.eq("artifactHash", mapping.oldHash)
            )
            .unique()
        );
        if (!artifact) {
          return yield* releaseFail(
            "CONTENT_RELEASE_INTEGRITY",
            "Try-out history cleanup lost an unreferenced source artifact."
          );
        }
        yield* Effect.promise(() =>
          ctx.db.delete("contentArtifacts", artifact._id)
        );
        deleted += 1;
      }
      yield* Effect.promise(() =>
        ctx.db.delete("tryoutHistoryMigrationMaps", mapping._id)
      );
      deleted += 1;
    }
    return mappings.length === 0
      ? null
      : ({ deleted, kind: "artifact" } satisfies CleanupPage);
  }
);

/** Deletes one bounded non-artifact mapping page. */
const cleanupMaps = Effect.fn("tryouts.migration.cleanupMaps")(function* (
  ctx: MutationCtx,
  migrationId: string,
  kind: "catalog" | "placement",
  cleanupKind: "catalogMap" | "placementMap"
) {
  const rows = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutHistoryMigrationMaps")
      .withIndex("by_migrationId_and_kind_and_index", (query) =>
        query.eq("migrationId", migrationId).eq("kind", kind)
      )
      .take(MAP_PAGE_COUNT)
  );
  yield* Effect.forEach(rows, (row) =>
    Effect.promise(() => ctx.db.delete("tryoutHistoryMigrationMaps", row._id))
  );
  return rows.length === 0
    ? null
    : ({ deleted: rows.length, kind: cleanupKind } satisfies CleanupPage);
});

/** Deletes one bounded temporary ledger page after source cleanup. */
export const cleanupLedger = Effect.fn("tryouts.migration.cleanupLedger")(
  function* (ctx: MutationCtx, migrationId: string) {
    const audits = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutHistoryAttemptMigrationAudits")
        .withIndex("by_migrationId_and_tryoutAttemptId", (query) =>
          query.eq("migrationId", migrationId)
        )
        .take(MAP_PAGE_COUNT)
    );
    if (audits.some(({ phase }) => phase !== "completed")) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Try-out history migration retained an unfinished attempt audit."
      );
    }
    if (audits.length > 0) {
      yield* Effect.forEach(audits, (audit) =>
        Effect.promise(() =>
          ctx.db.delete("tryoutHistoryAttemptMigrationAudits", audit._id)
        )
      );
      return {
        deleted: audits.length,
        kind: "audit",
      } satisfies CleanupPage;
    }
    const artifacts = yield* cleanupArtifacts(ctx, migrationId);
    if (artifacts !== null) {
      return artifacts;
    }
    const catalog = yield* cleanupMaps(
      ctx,
      migrationId,
      "catalog",
      "catalogMap"
    );
    if (catalog !== null) {
      return catalog;
    }
    const placements = yield* cleanupMaps(
      ctx,
      migrationId,
      "placement",
      "placementMap"
    );
    if (placements !== null) {
      return placements;
    }
    const scales = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutHistoryScaleMigrations")
        .withIndex("by_migrationId_and_oldScaleVersionId", (query) =>
          query.eq("migrationId", migrationId)
        )
        .take(MAP_PAGE_COUNT)
    );
    yield* Effect.forEach(scales, (scale) =>
      Effect.promise(() =>
        ctx.db.delete("tryoutHistoryScaleMigrations", scale._id)
      )
    );
    return scales.length === 0
      ? null
      : ({ deleted: scales.length, kind: "scaleMap" } satisfies CleanupPage);
  }
);
