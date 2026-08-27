import { describe, expect, it } from "@effect/vitest";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { compactSnapshots } from "@repo/backend/convex/contentRelease/snapshot/cleanup";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { abortProgram } from "@repo/backend/convex/tryouts/migration/abort";
import type { migrationStatusValidator } from "@repo/backend/convex/tryouts/migration/state/schema";
import {
  ABORT_MIGRATION_ID,
  ABORT_OWNED_ARTIFACT,
  ABORT_SHARED_ARTIFACT,
  ABORT_SOURCE_SNAPSHOT,
  ABORT_TARGET_SNAPSHOT,
  seedOwnedAbort,
  seedPendingAbort,
} from "@repo/backend/test/migration/abort";
import { makeFunctionReference } from "convex/server";
import type { Infer } from "convex/values";
import { convexTest } from "convex-test";
import { Effect } from "effect";

type MigrationStatus = Infer<typeof migrationStatusValidator>;

const initialize = makeFunctionReference<
  "mutation",
  { migrationId: string; sourceSnapshotId: string },
  MigrationStatus
>("tryouts/migration/state/store:initialize");

/** Runs one bounded abort page at the native Convex test boundary. */
function abort(ctx: MutationCtx, migrationId = ABORT_MIGRATION_ID) {
  return runConvexProgram(abortProgram(ctx, migrationId));
}

describe("tryouts/migration/abort", () => {
  it.effect("rejects missing and authorized migration roots", () =>
    Effect.gen(function* () {
      const missing = convexTest(schema, convexModules);
      yield* Effect.promise(() =>
        expect(missing.mutation((ctx) => abort(ctx))).rejects.toMatchObject({
          data: { code: "CONTENT_RELEASE_MISSING" },
        })
      );

      const ready = convexTest(schema, convexModules);
      yield* Effect.promise(() =>
        ready.mutation(async (ctx) => {
          await ctx.db.insert("tryoutHistoryMigrations", {
            artifactMapCount: 0,
            authorization: {
              planHash: `sha256:${"d".repeat(64)}`,
              planJson: "{}",
              sourceScaleVersionIds: [],
            },
            catalogMapCount: 0,
            createdAt: 1,
            migrationId: ABORT_MIGRATION_ID,
            phase: "ready",
            placementMapCount: 0,
            sourceSnapshotId: ABORT_SOURCE_SNAPSHOT,
            target: {
              bundleCreated: false,
              bundleHash: `sha256:${"e".repeat(64)}`,
              kind: "staged",
              snapshotCreated: false,
              snapshotId: `sha256:${"f".repeat(64)}`,
            },
            updatedAt: 1,
          });
        })
      );
      yield* Effect.promise(() =>
        expect(ready.mutation((ctx) => abort(ctx))).rejects.toMatchObject({
          data: { code: "CONTENT_RELEASE_STATE" },
        })
      );
    })
  );

  it.effect("replays a pending abort and consumes its exact tombstone", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      yield* Effect.promise(() => t.mutation(seedPendingAbort));

      const completed = yield* Effect.promise(() =>
        t.mutation((ctx) => abort(ctx))
      );
      const repeated = yield* Effect.promise(() =>
        t.mutation((ctx) => abort(ctx))
      );

      expect(completed).toEqual({
        deleted: 1,
        done: true,
        migrationId: ABORT_MIGRATION_ID,
      });
      expect(repeated).toEqual(completed);

      const restarted = yield* Effect.promise(() =>
        t.mutation(initialize, {
          migrationId: ABORT_MIGRATION_ID,
          sourceSnapshotId: ABORT_SOURCE_SNAPSHOT,
        })
      );
      const state = yield* Effect.promise(() =>
        t.run(async (ctx) => ({
          roots: await ctx.db.query("tryoutHistoryMigrations").take(2),
          tombstones: await ctx.db
            .query("tryoutHistoryMigrationAborts")
            .take(2),
        }))
      );

      expect(restarted.phase).toBe("staging");
      expect(state.roots).toHaveLength(1);
      expect(state.tombstones).toEqual([]);
    })
  );

  it.effect(
    "drains owned staging while preserving shared immutable bytes",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() => t.mutation(seedOwnedAbort));

        let result = yield* Effect.promise(() =>
          t.mutation((ctx) => abort(ctx))
        );
        while (!result.done) {
          result = yield* Effect.promise(() => t.mutation((ctx) => abort(ctx)));
        }
        const state = yield* Effect.promise(() =>
          t.run(async (ctx) => ({
            artifacts: await ctx.db.query("contentArtifacts").collect(),
            catalog: await ctx.db.query("tryoutCatalog").collect(),
            maps: await ctx.db.query("tryoutHistoryMigrationMaps").collect(),
            placements: await ctx.db.query("tryoutPlacements").collect(),
            roots: await ctx.db.query("tryoutHistoryMigrations").collect(),
            runtime: await ctx.db.query("tryoutRuntimeBundles").collect(),
            snapshots: await ctx.db.query("contentSnapshots").collect(),
            tombstone: await ctx.db
              .query("tryoutHistoryMigrationAborts")
              .unique(),
          }))
        );

        expect(result).toEqual({
          deleted: 10,
          done: true,
          migrationId: ABORT_MIGRATION_ID,
        });
        expect(state.artifacts).toMatchObject([
          { artifactHash: ABORT_SHARED_ARTIFACT },
        ]);
        expect(state.artifacts).not.toMatchObject([
          { artifactHash: ABORT_OWNED_ARTIFACT },
        ]);
        expect(state.catalog).toEqual([]);
        expect(state.maps).toEqual([]);
        expect(state.placements).toEqual([]);
        expect(state.roots).toEqual([]);
        expect(state.runtime).toEqual([]);
        expect(state.snapshots).toEqual([]);
        expect(state.tombstone?.deleted).toBe(10);
      })
  );

  it.effect("preserves a target retained by external snapshot evidence", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          await seedOwnedAbort(ctx);
          await ctx.db.insert("snapshotBatches", {
            batchHash: `sha256:${"d".repeat(64)}`,
            batchIndex: 0,
            createdAt: 1,
            family: "tryout",
            firstIndex: 0,
            releaseId: "external-snapshot-owner",
            rowCount: 2,
            sequence: 1,
            snapshotId: ABORT_TARGET_SNAPSHOT,
          });
        })
      );

      let result = yield* Effect.promise(() => t.mutation((ctx) => abort(ctx)));
      while (!result.done) {
        result = yield* Effect.promise(() => t.mutation((ctx) => abort(ctx)));
      }
      const retained = yield* Effect.promise(() =>
        t.run(async (ctx) => ({
          artifacts: await ctx.db.query("contentArtifacts").collect(),
          catalog: await ctx.db.query("tryoutCatalog").collect(),
          placements: await ctx.db.query("tryoutPlacements").collect(),
          runtime: await ctx.db.query("tryoutRuntimeBundles").collect(),
          snapshots: await ctx.db.query("contentSnapshots").collect(),
        }))
      );

      expect(result.deleted).toBe(5);
      expect(retained.artifacts).toHaveLength(2);
      expect(retained.catalog).toHaveLength(1);
      expect(retained.placements).toHaveLength(1);
      expect(retained.runtime).toHaveLength(1);
      expect(retained.snapshots).toHaveLength(1);
    })
  );

  it.effect(
    "keeps transferred target ownership when external evidence disappears",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        const batchId = yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            await seedOwnedAbort(ctx);
            return ctx.db.insert("snapshotBatches", {
              batchHash: `sha256:${"d".repeat(64)}`,
              batchIndex: 0,
              createdAt: 1,
              family: "tryout",
              firstIndex: 0,
              releaseId: "external-snapshot-owner",
              rowCount: 2,
              sequence: 1,
              snapshotId: ABORT_TARGET_SNAPSHOT,
            });
          })
        );

        const first = yield* Effect.promise(() =>
          t.mutation((ctx) => abort(ctx))
        );
        expect(first.done).toBe(false);
        yield* Effect.promise(() =>
          t.mutation((ctx) => ctx.db.delete("snapshotBatches", batchId))
        );

        let result = yield* Effect.promise(() =>
          t.mutation((ctx) => abort(ctx))
        );
        while (!result.done) {
          result = yield* Effect.promise(() => t.mutation((ctx) => abort(ctx)));
        }
        const retained = yield* Effect.promise(() =>
          t.run(async (ctx) => ({
            catalog: await ctx.db.query("tryoutCatalog").collect(),
            placements: await ctx.db.query("tryoutPlacements").collect(),
            runtime: await ctx.db.query("tryoutRuntimeBundles").collect(),
            snapshots: await ctx.db.query("contentSnapshots").collect(),
          }))
        );
        expect(retained.catalog).toHaveLength(1);
        expect(retained.placements).toHaveLength(1);
        expect(retained.runtime).toHaveLength(1);
        expect(retained.snapshots).toHaveLength(1);

        yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            const snapshot = await ctx.db.query("contentSnapshots").unique();
            if (snapshot) {
              await ctx.db.patch("contentSnapshots", snapshot._id, {
                retainUntil: 0,
              });
            }
          })
        );
        let compacted = false;
        while (!compacted) {
          const page = yield* Effect.promise(() =>
            t.mutation((ctx) => runConvexProgram(compactSnapshots(ctx, 0)))
          );
          compacted = page.done;
        }
        const cleaned = yield* Effect.promise(() =>
          t.run(async (ctx) => ({
            catalog: await ctx.db.query("tryoutCatalog").collect(),
            placements: await ctx.db.query("tryoutPlacements").collect(),
            runtime: await ctx.db.query("tryoutRuntimeBundles").collect(),
            snapshots: await ctx.db.query("contentSnapshots").collect(),
          }))
        );
        expect(cleaned).toEqual({
          catalog: [],
          placements: [],
          runtime: [],
          snapshots: [],
        });
      })
  );

  it.effect(
    "rolls the state transition back when owned bytes are missing",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            await ctx.db.insert("tryoutHistoryMigrationMaps", {
              identity: "artifact:missing",
              index: 0,
              kind: "artifact",
              migrationId: ABORT_MIGRATION_ID,
              newHash: `sha256:${"7".repeat(64)}`,
              oldHash: `sha256:${"8".repeat(64)}`,
              targetCreated: true,
            });
            await ctx.db.insert("tryoutHistoryMigrations", {
              artifactMapCount: 1,
              catalogMapCount: 0,
              createdAt: 1,
              migrationId: ABORT_MIGRATION_ID,
              phase: "staging",
              placementMapCount: 0,
              sourceSnapshotId: ABORT_SOURCE_SNAPSHOT,
              target: { kind: "pending" },
              updatedAt: 1,
            });
          })
        );

        yield* Effect.promise(() =>
          expect(t.mutation((ctx) => abort(ctx))).rejects.toMatchObject({
            data: { code: "CONTENT_RELEASE_INTEGRITY" },
          })
        );
        const state = yield* Effect.promise(() =>
          t.run(async (ctx) => ({
            maps: await ctx.db.query("tryoutHistoryMigrationMaps").take(2),
            root: await ctx.db.query("tryoutHistoryMigrations").unique(),
          }))
        );

        expect(state.maps).toHaveLength(1);
        expect(state.root?.phase).toBe("staging");
      })
  );
});
