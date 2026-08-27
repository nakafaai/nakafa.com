import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { isArtifactReferenced } from "@repo/backend/convex/contentRelease/retention";
import type { AbortingMigration } from "@repo/backend/convex/tryouts/migration/abort/state";
import {
  hasAbortSnapshotReference,
  transferAbortTarget,
} from "@repo/backend/convex/tryouts/migration/abort/target";
import { Effect } from "effect";

const MAP_PAGE_LIMIT = 8;
const MAP_KINDS = ["catalog", "placement", "artifact"] as const;

type MigrationMap = Doc<"tryoutHistoryMigrationMaps">;

export interface AbortMapPage {
  readonly deleted: number;
  readonly maps: {
    readonly artifact: number;
    readonly catalog: number;
    readonly placement: number;
  };
}

/** Reads the next ordered mapping page from one aborting root. */
const loadMapPage = Effect.fn("tryouts.migration.loadAbortMapPage")(function* (
  ctx: MutationCtx,
  migrationId: string
) {
  for (const kind of MAP_KINDS) {
    const mappings = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutHistoryMigrationMaps")
        .withIndex("by_migrationId_and_kind_and_index", (query) =>
          query.eq("migrationId", migrationId).eq("kind", kind)
        )
        .take(MAP_PAGE_LIMIT)
    );
    if (mappings.length > 0) {
      return mappings;
    }
  }
  return [];
});

/** Loads one exact immutable row addressed by a migration mapping. */
const loadMappedRow = Effect.fn("tryouts.migration.loadAbortMappedRow")(
  function* (ctx: MutationCtx, snapshotId: string, mapping: MigrationMap) {
    if (mapping.kind === "catalog") {
      const row = yield* Effect.promise(() =>
        ctx.db
          .query("tryoutCatalog")
          .withIndex("by_snapshotId_and_index", (query) =>
            query.eq("snapshotId", snapshotId).eq("index", mapping.index)
          )
          .unique()
      );
      if (
        !row ||
        row.identity !== mapping.identity ||
        row.rowHash !== mapping.newHash
      ) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          "Try-out history abort found an incoherent target catalog row."
        );
      }
      return { row, table: "tryoutCatalog" } as const;
    }
    const row = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutPlacements")
        .withIndex("by_snapshotId_and_index", (query) =>
          query.eq("snapshotId", snapshotId).eq("index", mapping.index)
        )
        .unique()
    );
    if (
      !row ||
      row.identity !== mapping.identity ||
      row.rowHash !== mapping.newHash
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Try-out history abort found an incoherent target placement row."
      );
    }
    return { row, table: "tryoutPlacements" } as const;
  }
);

/** Deletes one migration-created row only while its snapshot stays private. */
const deleteMappedRow = Effect.fn("tryouts.migration.deleteAbortMappedRow")(
  function* (
    ctx: MutationCtx,
    migration: AbortingMigration,
    mapping: MigrationMap,
    snapshotReferenced: boolean
  ) {
    if (migration.target.kind !== "staged") {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "A pending try-out history target owns staged row mappings."
      );
    }
    const target = yield* loadMappedRow(
      ctx,
      migration.target.snapshotId,
      mapping
    );
    if (
      !mapping.targetCreated ||
      snapshotReferenced ||
      !migration.target.snapshotCreated
    ) {
      return 0;
    }
    if (target.table === "tryoutCatalog") {
      yield* Effect.promise(() =>
        ctx.db.delete("tryoutCatalog", target.row._id)
      );
    } else {
      yield* Effect.promise(() =>
        ctx.db.delete("tryoutPlacements", target.row._id)
      );
    }
    return 1;
  }
);

/** Deletes one migration-created artifact only after all row references leave. */
const deleteMappedArtifact = Effect.fn(
  "tryouts.migration.deleteAbortMappedArtifact"
)(function* (
  ctx: MutationCtx,
  migration: AbortingMigration,
  mapping: MigrationMap
) {
  if (!mapping.targetCreated) {
    return 0;
  }
  const artifact = yield* Effect.promise(() =>
    ctx.db
      .query("contentArtifacts")
      .withIndex("by_artifactHash", (query) =>
        query.eq("artifactHash", mapping.newHash)
      )
      .unique()
  );
  if (!artifact) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history abort found a missing target artifact."
    );
  }
  if (
    yield* isArtifactReferenced(ctx, mapping.newHash, {
      ignoredMigrationId: migration.migrationId,
    })
  ) {
    return 0;
  }
  yield* Effect.promise(() => ctx.db.delete("contentArtifacts", artifact._id));
  return 1;
});

/** Deletes one bounded mapping page and only its migration-owned targets. */
export const deleteAbortMapPage = Effect.fn(
  "tryouts.migration.deleteAbortMapPage"
)(function* (ctx: MutationCtx, migration: AbortingMigration) {
  const mappings = yield* loadMapPage(ctx, migration.migrationId);
  const snapshotReferenced = mappings.some(
    (mapping) => mapping.kind !== "artifact"
  )
    ? yield* hasAbortSnapshotReference(ctx, migration)
    : false;
  if (snapshotReferenced) {
    yield* transferAbortTarget(ctx, migration);
  }
  const maps = { artifact: 0, catalog: 0, placement: 0 };
  let deleted = 0;
  for (const mapping of mappings) {
    deleted +=
      mapping.kind === "artifact"
        ? yield* deleteMappedArtifact(ctx, migration, mapping)
        : yield* deleteMappedRow(ctx, migration, mapping, snapshotReferenced);
    yield* Effect.promise(() =>
      ctx.db.delete("tryoutHistoryMigrationMaps", mapping._id)
    );
    maps[mapping.kind] += 1;
    deleted += 1;
  }
  return { deleted, maps } satisfies AbortMapPage;
});
