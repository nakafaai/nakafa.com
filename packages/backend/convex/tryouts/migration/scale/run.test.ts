import { assert, describe, it } from "@effect/vitest";
import { hashText } from "@repo/backend/convex/contentRelease/digest";
import {
  readConvexErrorData,
  runConvexProgram,
} from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { retainedTryoutHistoryPlan } from "@repo/backend/convex/tryouts/history/spec";
import {
  readTryoutHistoryScaleInventory,
  TRYOUT_HISTORY_SCALE_INVENTORY_DOMAIN,
} from "@repo/backend/convex/tryouts/migration/scale/inventory";
import { migrateTryoutHistoryScale } from "@repo/backend/convex/tryouts/migration/scale/run";
import { convexTest } from "convex-test";
import { Effect } from "effect";

const MIGRATION_ID = "test-tryout-history-migration";
const TARGET_SNAPSHOT_ID = `sha256:${"b".repeat(64)}`;
const OLD_PLACEMENT_HASH = `sha256:${"c".repeat(64)}`;
const NEW_PLACEMENT_HASH = `sha256:${"d".repeat(64)}`;

describe("tryouts/migration/scale/run", () => {
  it.effect(
    "clones and reuses an exact graph while rejecting source or target drift",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        const seeded = yield* Effect.promise(() =>
          t.mutation((ctx) =>
            runConvexProgram(
              Effect.gen(function* () {
                const sourceScaleId = yield* Effect.promise(() =>
                  ctx.db.insert("irtScaleVersions", {
                    model: "2pl",
                    publishedAt: 1000,
                    questionCount: 1,
                    setIdentity: "set:id",
                    status: "official",
                    tryoutSnapshotId: retainedTryoutHistoryPlan.snapshotId,
                  })
                );
                const sourceRunId = yield* Effect.promise(() =>
                  ctx.db.insert("irtCalibrationRuns", {
                    attemptCount: 9,
                    completedAt: 1400,
                    iterationCount: 4,
                    maxParameterDelta: 0.01,
                    model: "2pl",
                    questionCount: 1,
                    responseCount: 9,
                    scaleVersionId: sourceScaleId,
                    sectionIdentity: "section:id",
                    startedAt: 1200,
                    status: "completed",
                    updatedAt: 1400,
                  })
                );
                const sourceItemId = yield* Effect.promise(() =>
                  ctx.db.insert("irtScaleItems", {
                    calibrationRunId: sourceRunId,
                    calibrationStatus: "calibrated",
                    correctRate: 0.6,
                    difficulty: 0.2,
                    discrimination: 1.1,
                    placementIdentity: "placement:id",
                    placementRowHash: OLD_PLACEMENT_HASH,
                    responseCount: 9,
                    scaleVersionId: sourceScaleId,
                  })
                );
                yield* Effect.promise(() =>
                  ctx.db.insert("tryoutHistoryMigrationMaps", {
                    identity: "placement:id",
                    index: 54,
                    kind: "placement",
                    migrationId: MIGRATION_ID,
                    newHash: NEW_PLACEMENT_HASH,
                    oldHash: OLD_PLACEMENT_HASH,
                    targetCreated: false,
                  })
                );
                const inventory = yield* readTryoutHistoryScaleInventory(ctx, [
                  sourceScaleId,
                ]);
                const digest = yield* hashText(
                  "retained try-out scale inventory",
                  `${TRYOUT_HISTORY_SCALE_INVENTORY_DOMAIN}\n${inventory.inventoryJson}`
                );
                const evidence = {
                  digest,
                  itemCount: inventory.itemCount,
                  runCount: inventory.runCount,
                  versionCount: inventory.count,
                };
                const first = yield* migrateTryoutHistoryScale(
                  ctx,
                  MIGRATION_ID,
                  sourceScaleId,
                  [sourceScaleId],
                  evidence,
                  TARGET_SNAPSHOT_ID
                );
                const second = yield* migrateTryoutHistoryScale(
                  ctx,
                  MIGRATION_ID,
                  sourceScaleId,
                  [sourceScaleId],
                  evidence,
                  TARGET_SNAPSHOT_ID
                );
                return { evidence, first, second, sourceItemId, sourceScaleId };
              })
            )
          )
        );

        assert.strictEqual(seeded.first.itemCount, 1);
        assert.strictEqual(seeded.first.runCount, 1);
        assert.strictEqual(seeded.first.scaleVersionCount, 1);
        assert.strictEqual(seeded.second.itemCount, 0);
        assert.strictEqual(seeded.second.runCount, 0);
        assert.strictEqual(seeded.second.scaleVersionCount, 0);
        assert.strictEqual(
          seeded.second.scaleVersionId,
          seeded.first.scaleVersionId
        );
        const targetScale = yield* Effect.promise(() =>
          t.query((ctx) => ctx.db.get(seeded.first.scaleVersionId))
        );
        assert.strictEqual(targetScale?.history, true);
        const targetItemId = yield* Effect.promise(() =>
          t.query(async (ctx) => {
            const item = await ctx.db
              .query("irtScaleItems")
              .withIndex("by_scaleVersionId_and_placementIdentity", (query) =>
                query
                  .eq("scaleVersionId", seeded.first.scaleVersionId)
                  .eq("placementIdentity", "placement:id")
              )
              .unique();
            assert.ok(item);
            assert.strictEqual(item.calibrationStatus, "calibrated");
            assert.strictEqual(item.correctRate, 0.6);
            assert.strictEqual(item.difficulty, 0.2);
            assert.strictEqual(item.discrimination, 1.1);
            assert.strictEqual(item.placementRowHash, NEW_PLACEMENT_HASH);
            assert.strictEqual(item.responseCount, 9);
            return item._id;
          })
        );

        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            ctx.db.patch("irtScaleItems", targetItemId, { difficulty: 0.3 })
          )
        );
        const targetFailure = yield* Effect.tryPromise(() =>
          t.mutation((ctx) =>
            runConvexProgram(
              migrateTryoutHistoryScale(
                ctx,
                MIGRATION_ID,
                seeded.sourceScaleId,
                [seeded.sourceScaleId],
                seeded.evidence,
                TARGET_SNAPSHOT_ID
              )
            )
          )
        ).pipe(
          Effect.flip,
          Effect.map((error) => error.cause)
        );
        assert.strictEqual(
          readConvexErrorData(targetFailure)?.code,
          "CONTENT_RELEASE_INTEGRITY"
        );

        yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            await ctx.db.patch("irtScaleItems", targetItemId, {
              difficulty: 0.2,
            });
            await ctx.db.patch("irtScaleItems", seeded.sourceItemId, {
              correctRate: 0.7,
            });
          })
        );
        const sourceFailure = yield* Effect.tryPromise(() =>
          t.mutation((ctx) =>
            runConvexProgram(
              migrateTryoutHistoryScale(
                ctx,
                MIGRATION_ID,
                seeded.sourceScaleId,
                [seeded.sourceScaleId],
                seeded.evidence,
                TARGET_SNAPSHOT_ID
              )
            )
          )
        ).pipe(
          Effect.flip,
          Effect.map((error) => error.cause)
        );
        assert.strictEqual(
          readConvexErrorData(sourceFailure)?.code,
          "CONTENT_RELEASE_INTEGRITY"
        );
      })
  );

  it.effect("rejects a corrupted scale count before reading its graph", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const scaleVersionId = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          ctx.db.insert("irtScaleVersions", {
            model: "2pl",
            publishedAt: 1000,
            questionCount: retainedTryoutHistoryPlan.placementRowCount + 1,
            setIdentity: "set:corrupted",
            status: "official",
            tryoutSnapshotId: retainedTryoutHistoryPlan.snapshotId,
          })
        )
      );
      const failure = yield* Effect.tryPromise(() =>
        t.query((ctx) =>
          runConvexProgram(
            readTryoutHistoryScaleInventory(ctx, [scaleVersionId])
          )
        )
      ).pipe(
        Effect.flip,
        Effect.map((error) => error.cause)
      );

      assert.strictEqual(
        readConvexErrorData(failure)?.code,
        "CONTENT_RELEASE_INTEGRITY"
      );
    })
  );
});
