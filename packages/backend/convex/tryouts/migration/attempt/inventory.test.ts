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
  hashTryoutHistoryAttemptEntry,
  readTryoutHistoryAttemptEntry,
  readTryoutHistoryAttemptInventory,
  TRYOUT_HISTORY_ATTEMPT_INVENTORY_DOMAIN,
  verifyTryoutHistoryAttemptInventory,
} from "@repo/backend/convex/tryouts/migration/attempt/inventory";
import {
  insertTryoutAttempt,
  insertTryoutUser,
} from "@repo/backend/test/tryout/runtime";
import { makeTryoutSet } from "@repo/backend/test/tryouts";
import { convexTest } from "convex-test";
import { Effect } from "effect";

describe("tryouts/migration/attempt/inventory", () => {
  it.effect("excludes mutable set progress from authorization", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const seeded = yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const userId = await insertTryoutUser(ctx, {
            authId: "migration-progress-user",
            email: "migration-progress@example.com",
            name: "Migration Progress",
          });
          const attemptId = await insertTryoutAttempt(ctx, {
            sectionSnapshots: [],
            set: makeTryoutSet(),
            snapshotReleaseId: "retained-release",
            status: "completed",
            userId,
          });
          const attempt = await ctx.db.get(attemptId);
          if (!attempt) {
            throw new Error("Expected retained progress attempt fixture.");
          }
          await ctx.db.insert("tryoutAttemptHistory", {
            snapshotReleaseId: attempt.snapshotReleaseId,
            tryoutAttemptId: attemptId,
            tryoutSnapshotId: attempt.tryoutSnapshotId,
          });
          const progressId = await ctx.db.insert("tryoutSetProgress", {
            appLocale: attempt.appLocale,
            attemptNumber: 1,
            countryKey: attempt.countryKey,
            examKey: attempt.examKey,
            latestAttemptId: attemptId,
            publishedScore: null,
            setIdentity: attempt.setIdentity,
            setKey: attempt.setKey,
            status: attempt.status,
            statusRank: 1,
            trackKey: attempt.trackKey,
            updatedAt: attempt.lastActivityAt,
            userId,
          });
          return { progressId, userId };
        })
      );
      const entryDigest = () =>
        t.query((ctx) =>
          runConvexProgram(
            Effect.gen(function* () {
              const marker = yield* Effect.promise(() =>
                ctx.db.query("tryoutAttemptHistory").unique()
              );
              if (!marker) {
                return yield* Effect.die("Expected retained history marker.");
              }
              const entry = yield* readTryoutHistoryAttemptEntry(ctx, marker);
              return yield* hashTryoutHistoryAttemptEntry(entry);
            })
          )
        );
      const expected = yield* Effect.promise(() =>
        t.query((ctx) =>
          runConvexProgram(
            Effect.gen(function* () {
              const inventory = yield* readTryoutHistoryAttemptInventory(ctx);
              return {
                attemptCount: inventory.attemptCount,
                digest: yield* hashText(
                  "retained try-out attempt inventory",
                  `${TRYOUT_HISTORY_ATTEMPT_INVENTORY_DOMAIN}\n${inventory.inventoryJson}`
                ),
                frozenPlacementCount: inventory.frozenPlacementCount,
                progressCount: inventory.progressCount,
                responseCount: inventory.responseCount,
                scoreCount: inventory.scoreCount,
                sectionAttemptCount: inventory.sectionAttemptCount,
              };
            })
          )
        )
      );
      const before = yield* Effect.promise(entryDigest);

      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const latestAttemptId = await insertTryoutAttempt(ctx, {
            sectionSnapshots: [],
            set: makeTryoutSet(),
            status: "in-progress",
            userId: seeded.userId,
          });
          await ctx.db.patch("tryoutSetProgress", seeded.progressId, {
            attemptNumber: 2,
            latestAttemptId,
            updatedAt: 2,
          });
        })
      );
      const after = yield* Effect.promise(entryDigest);
      const verified = yield* Effect.promise(() =>
        t.query((ctx) =>
          runConvexProgram(verifyTryoutHistoryAttemptInventory(ctx, expected))
        )
      );

      assert.strictEqual(after, before);
      assert.strictEqual(expected.progressCount, 1);
      assert.strictEqual(verified.progressCount, 0);
    })
  );

  it.effect("binds every private attempt-owned byte before migration", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const { attemptId, scoreId } = yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const userId = await insertTryoutUser(ctx, {
            authId: "migration-inventory-user",
            email: "migration-inventory@example.com",
            name: "Migration Inventory",
          });
          const attemptId = await insertTryoutAttempt(ctx, {
            sectionSnapshots: [],
            set: makeTryoutSet(),
            snapshotReleaseId: "retained-release",
            status: "completed",
            userId,
          });
          const attempt = await ctx.db.get(attemptId);
          if (!attempt) {
            throw new Error("Expected retained attempt fixture.");
          }
          await ctx.db.insert("tryoutAttemptHistory", {
            snapshotReleaseId: attempt.snapshotReleaseId,
            tryoutAttemptId: attemptId,
            tryoutSnapshotId: attempt.tryoutSnapshotId,
          });
          const scoreId = await ctx.db.insert("tryoutScores", {
            finalizedAt: attempt.lastActivityAt,
            publishedScore: 72,
            rawScore: 72,
            scoreStatus: attempt.scoreStatus,
            scoringStrategy: attempt.scoringStrategy,
            setIdentity: attempt.setIdentity,
            totalCorrect: 0,
            totalQuestions: 0,
            tryoutAttemptId: attemptId,
            tryoutSnapshotId: attempt.tryoutSnapshotId,
            userId,
          });
          return { attemptId, scoreId };
        })
      );
      const expected = yield* Effect.promise(() =>
        t.query((ctx) =>
          runConvexProgram(
            Effect.gen(function* () {
              const inventory = yield* readTryoutHistoryAttemptInventory(ctx);
              const digest = yield* hashText(
                "retained try-out attempt inventory",
                `${TRYOUT_HISTORY_ATTEMPT_INVENTORY_DOMAIN}\n${inventory.inventoryJson}`
              );
              return {
                attemptCount: inventory.attemptCount,
                digest,
                frozenPlacementCount: inventory.frozenPlacementCount,
                progressCount: inventory.progressCount,
                responseCount: inventory.responseCount,
                scoreCount: inventory.scoreCount,
                sectionAttemptCount: inventory.sectionAttemptCount,
              };
            })
          )
        )
      );

      const verified = yield* Effect.promise(() =>
        t.query((ctx) =>
          runConvexProgram(verifyTryoutHistoryAttemptInventory(ctx, expected))
        )
      );
      assert.strictEqual(verified.attemptCount, 1);
      assert.strictEqual(verified.scoreCount, 1);

      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          ctx.db.patch("tryoutScores", scoreId, { publishedScore: 73 })
        )
      );
      const changedFailure = yield* Effect.tryPromise(() =>
        t.query((ctx) =>
          runConvexProgram(verifyTryoutHistoryAttemptInventory(ctx, expected))
        )
      ).pipe(
        Effect.flip,
        Effect.map((error) => error.cause)
      );
      assert.strictEqual(
        readConvexErrorData(changedFailure)?.code,
        "CONTENT_RELEASE_INTEGRITY"
      );

      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          ctx.db.patch("tryoutAttempts", attemptId, {
            totalQuestions: retainedTryoutHistoryPlan.frozenPlacementCount + 1,
          })
        )
      );
      const boundFailure = yield* Effect.tryPromise(() =>
        t.query((ctx) =>
          runConvexProgram(readTryoutHistoryAttemptInventory(ctx))
        )
      ).pipe(
        Effect.flip,
        Effect.map((error) => error.cause)
      );
      assert.strictEqual(
        readConvexErrorData(boundFailure)?.code,
        "CONTENT_RELEASE_INTEGRITY"
      );
    })
  );
});
