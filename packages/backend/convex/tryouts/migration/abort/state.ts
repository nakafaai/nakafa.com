import { computeTryoutHistoryAbortLimit } from "@nakafa/aksara-contracts/migration/tryout/history/abort";
import { TryoutHistoryMigrationAbortingStatusSchema } from "@nakafa/aksara-contracts/transport/migration/tryout/response";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { contractFailure } from "@repo/backend/convex/contentRelease/proof/failure";
import { migrationStatus } from "@repo/backend/convex/tryouts/migration/state/store";
import { Clock, Effect, Schema } from "effect";

export type AbortingMigration = Extract<
  Doc<"tryoutHistoryMigrations">,
  { readonly phase: "aborting" }
>;

/** Loads the sole staging root or its exact final retry tombstone. */
export const loadAbortState = Effect.fn("tryouts.migration.loadAbortState")(
  function* (ctx: MutationCtx, migrationId: string) {
    const [roots, tombstones] = yield* Effect.all([
      Effect.promise(() => ctx.db.query("tryoutHistoryMigrations").take(2)),
      Effect.promise(() =>
        ctx.db.query("tryoutHistoryMigrationAborts").take(2)
      ),
    ]);
    if (roots.length > 1 || tombstones.length > 1) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Try-out history abort found duplicate migration state."
      );
    }
    const root = roots[0];
    const tombstone = tombstones[0];
    if (root && tombstone) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Try-out history abort found both a root and tombstone."
      );
    }
    if (root) {
      if (root.migrationId !== migrationId) {
        return yield* releaseFail(
          "CONTENT_RELEASE_CONFLICT",
          `Try-out history migration ${root.migrationId} owns staging.`
        );
      }
      return { kind: "root", root } as const;
    }
    if (tombstone) {
      if (tombstone.migrationId !== migrationId) {
        return yield* releaseFail(
          "CONTENT_RELEASE_CONFLICT",
          `Try-out history abort ${tombstone.migrationId} owns final evidence.`
        );
      }
      return { kind: "tombstone", tombstone } as const;
    }
    return yield* releaseFail(
      "CONTENT_RELEASE_MISSING",
      `Try-out history migration ${migrationId} does not exist.`
    );
  }
);

/** Atomically stops staging before any owned target can be removed. */
export const beginAbort = Effect.fn("tryouts.migration.beginAbort")(function* (
  ctx: MutationCtx,
  root: Doc<"tryoutHistoryMigrations">
) {
  if (root.phase === "aborting") {
    return root;
  }
  if (root.phase !== "staging") {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      `Try-out history migration ${root.migrationId} cannot abort from ${root.phase}.`
    );
  }
  const now = yield* Clock.currentTimeMillis;
  const started = {
    ...root,
    abort: {
      deleted: 0,
      maps: { artifact: 0, catalog: 0, placement: 0 },
    },
    phase: "aborting" as const,
    updatedAt: now,
  };
  yield* Effect.promise(() =>
    ctx.db.patch("tryoutHistoryMigrations", root._id, {
      abort: started.abort,
      phase: started.phase,
      updatedAt: started.updatedAt,
    })
  );
  return started;
});

/** Decodes the public status before using the contract-owned deletion bound. */
const abortLimit = Effect.fn("tryouts.migration.abortLimit")(function* (
  migration: AbortingMigration
) {
  const status = yield* Schema.decodeUnknownEffect(
    TryoutHistoryMigrationAbortingStatusSchema
  )(migrationStatus(migration));
  return yield* computeTryoutHistoryAbortLimit(status);
}, Effect.mapError(contractFailure));

/** Rejects cumulative progress outside the immutable staging inventory. */
export const validateAbortProgress = Effect.fn(
  "tryouts.migration.validateAbortProgress"
)(function* (
  migration: AbortingMigration,
  deleted: number,
  maps: AbortingMigration["abort"]["maps"]
) {
  const limit = yield* abortLimit(migration);
  if (
    !Number.isSafeInteger(deleted) ||
    deleted < migration.abort.deleted ||
    deleted > limit ||
    maps.artifact > migration.artifactMapCount ||
    maps.catalog > migration.catalogMapCount ||
    maps.placement > migration.placementMapCount
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Try-out history migration ${migration.migrationId} exceeded its abort inventory.`
    );
  }
});

/** Proves that finalization cannot strand temporary migration rows. */
export const validateAbortFinalState = Effect.fn(
  "tryouts.migration.validateAbortFinalState"
)(function* (ctx: MutationCtx, migration: AbortingMigration) {
  if (
    migration.abort.maps.artifact !== migration.artifactMapCount ||
    migration.abort.maps.catalog !== migration.catalogMapCount ||
    migration.abort.maps.placement !== migration.placementMapCount
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Try-out history migration ${migration.migrationId} lost abort mappings.`
    );
  }
  const [mapping, audit, scale, receipt] = yield* Effect.all([
    Effect.promise(() => ctx.db.query("tryoutHistoryMigrationMaps").first()),
    Effect.promise(() =>
      ctx.db.query("tryoutHistoryAttemptMigrationAudits").first()
    ),
    Effect.promise(() => ctx.db.query("tryoutHistoryScaleMigrations").first()),
    Effect.promise(() =>
      ctx.db.query("tryoutHistoryMigrationReceipts").first()
    ),
  ]);
  if (mapping || audit || scale || receipt) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history abort found unexpected temporary or terminal residue."
    );
  }
});
