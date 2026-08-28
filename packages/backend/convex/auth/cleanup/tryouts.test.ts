import { describe, expect, it } from "@effect/vitest";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { cleanupUserTryouts } from "@repo/backend/convex/auth/cleanup/tryouts";
import { abortProgram } from "@repo/backend/convex/contentRelease/abort";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { storeRuntimeFixture } from "@repo/backend/test/runtime/bundle";
import {
  insertRuntimeIngressSource,
  makeRuntimeIngressFixture,
} from "@repo/backend/test/runtime/ingress";
import {
  insertTryoutAttempt,
  insertTryoutUser,
  seedTryoutContentAccessState,
} from "@repo/backend/test/tryout/runtime";
import { makeTryoutSet } from "@repo/backend/test/tryouts";
import { Effect } from "effect";

describe("auth/cleanup/tryouts", () => {
  it.effect("preserves an attempt held by signed migration", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      const seeded = yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const runtime = await seedTryoutContentAccessState(ctx, {
            attemptStatus: "completed",
            sectionStatus: "completed",
            suffix: "cleanup-migration-hold",
          });
          const attempt = await ctx.db.get(runtime.attemptId);
          if (!attempt) {
            throw new Error("Expected held cleanup attempt.");
          }
          const markerId = await ctx.db.insert("tryoutAttemptHistory", {
            snapshotReleaseId: attempt.snapshotReleaseId,
            tryoutAttemptId: attempt._id,
            tryoutSnapshotId: attempt.tryoutSnapshotId,
          });
          await ctx.db.insert("tryoutHistoryAttemptMigrationAudits", {
            migrationId: "cleanup-migration-hold",
            phase: "pending",
            sourceDigest: "source-digest",
            tryoutAttemptHistoryId: markerId,
            tryoutAttemptId: attempt._id,
            userId: attempt.userId,
          });
          return { attemptId: attempt._id, userId: attempt.userId };
        })
      );

      yield* Effect.promise(() =>
        expect(
          t.mutation((ctx) =>
            runConvexProgram(cleanupUserTryouts(ctx, seeded.userId))
          )
        ).rejects.toMatchObject({
          data: { code: "USER_CLEANUP_FAILED" },
        })
      );
      const state = yield* Effect.promise(() =>
        t.query(async (ctx) => ({
          attempt: await ctx.db.get(seeded.attemptId),
          placements: await ctx.db
            .query("tryoutAttemptPlacements")
            .withIndex("by_tryoutAttemptId_and_questionOrder", (query) =>
              query.eq("tryoutAttemptId", seeded.attemptId)
            )
            .collect(),
          sections: await ctx.db
            .query("tryoutSectionAttempts")
            .withIndex("by_tryoutAttemptId_and_sectionOrder", (query) =>
              query.eq("tryoutAttemptId", seeded.attemptId)
            )
            .collect(),
        }))
      );

      expect(state.attempt).not.toBeNull();
      expect(state.placements).toHaveLength(1);
      expect(state.sections).toHaveLength(1);
    })
  );

  it.effect("deletes the last attempt and its migrated history scale", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      const seeded = yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const runtime = await seedTryoutContentAccessState(ctx, {
            attemptStatus: "completed",
            sectionStatus: "completed",
            suffix: "cleanup-history-scale",
          });
          const scaleVersionId = await ctx.db.insert("irtScaleVersions", {
            history: true,
            model: "2pl",
            publishedAt: 1,
            questionCount: 1,
            setIdentity: "set:cleanup-history-scale",
            status: "official",
            tryoutSnapshotId: "snapshot:cleanup-history-scale",
          });
          const runId = await ctx.db.insert("irtCalibrationRuns", {
            attemptCount: 1,
            iterationCount: 1,
            maxParameterDelta: 0,
            model: "2pl",
            questionCount: 1,
            responseCount: 1,
            scaleVersionId,
            sectionIdentity: "section:cleanup-history-scale",
            startedAt: 1,
            status: "completed",
            updatedAt: 1,
          });
          await ctx.db.insert("irtScaleItems", {
            calibrationRunId: runId,
            calibrationStatus: "calibrated",
            correctRate: 1,
            difficulty: 0,
            discrimination: 1,
            placementIdentity: "placement:cleanup-history-scale",
            placementRowHash: `sha256:${"a".repeat(64)}`,
            responseCount: 1,
            scaleVersionId,
          });
          await ctx.db.patch("tryoutAttempts", runtime.attemptId, {
            scaleVersionId,
          });
          return {
            attemptId: runtime.attemptId,
            scaleVersionId,
            userId: runtime.identity.userId,
          };
        })
      );

      let progressed = true;
      for (let page = 0; page < 16 && progressed; page += 1) {
        progressed = yield* Effect.promise(() =>
          t.mutation((ctx) =>
            runConvexProgram(cleanupUserTryouts(ctx, seeded.userId))
          )
        );
      }
      expect(progressed).toBe(false);
      const state = yield* Effect.promise(() =>
        t.query(async (ctx) => ({
          attempt: await ctx.db.get(seeded.attemptId),
          items: await ctx.db.query("irtScaleItems").collect(),
          runs: await ctx.db.query("irtCalibrationRuns").collect(),
          scale: await ctx.db.get(seeded.scaleVersionId),
        }))
      );
      expect(state).toEqual({
        attempt: null,
        items: [],
        runs: [],
        scale: null,
      });
    })
  );

  it.effect(
    "deletes an unowned runtime after erasing its last migrated attempt",
    () =>
      Effect.gen(function* () {
        const t = createConvexTestWithBetterAuth();
        const releaseId = ReleaseIdSchema.make("release-runtime-erasure");
        const fixture = yield* makeRuntimeIngressFixture(releaseId);
        yield* insertRuntimeIngressSource(t, fixture);
        yield* storeRuntimeFixture(t, fixture);
        const seeded = yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            const runtime = await ctx.db.query("tryoutRuntimeBundles").unique();
            if (!runtime) {
              throw new Error("Expected migrated attempt runtime.");
            }
            const owners: Array<{
              readonly attemptId: Id<"tryoutAttempts">;
              readonly userId: Id<"users">;
            }> = [];
            for (const suffix of ["first", "last"] as const) {
              const userId = await insertTryoutUser(ctx, {
                authId: `runtime-erasure-${suffix}`,
                email: `runtime-erasure-${suffix}@example.com`,
                name: `Runtime Erasure ${suffix}`,
              });
              const attemptId = await insertTryoutAttempt(ctx, {
                sectionSnapshots: [],
                set: makeTryoutSet({ questionCount: 1 }),
                snapshotId: runtime.snapshotId,
                snapshotReleaseId: releaseId,
                userId,
              });
              await ctx.db.patch("tryoutAttempts", attemptId, {
                tryoutBundleHash: runtime.bundleHash,
                tryoutBundleId: runtime._id,
              });
              await ctx.db.insert("tryoutAttemptHistory", {
                snapshotReleaseId: releaseId,
                tryoutAttemptId: attemptId,
                tryoutSnapshotId: runtime.snapshotId,
              });
              owners.push({ attemptId, userId });
            }
            return owners;
          })
        );

        const firstAbort = yield* Effect.promise(() =>
          t.mutation((ctx) => runConvexProgram(abortProgram(ctx, releaseId)))
        );
        const firstOwner = seeded[0];
        const lastOwner = seeded[1];
        if (!(firstOwner && lastOwner)) {
          return yield* Effect.die("Expected two migrated attempt owners.");
        }
        let firstProgressed = true;
        for (let page = 0; page < 8 && firstProgressed; page += 1) {
          firstProgressed = yield* Effect.promise(() =>
            t.mutation((ctx) =>
              runConvexProgram(cleanupUserTryouts(ctx, firstOwner.userId))
            )
          );
        }
        const retained = yield* Effect.promise(() =>
          t.query(async (ctx) => ({
            attempt: await ctx.db.get("tryoutAttempts", lastOwner.attemptId),
            runtime: await ctx.db.query("tryoutRuntimeBundles").collect(),
          }))
        );
        let lastProgressed = true;
        for (let page = 0; page < 8 && lastProgressed; page += 1) {
          lastProgressed = yield* Effect.promise(() =>
            t.mutation((ctx) =>
              runConvexProgram(cleanupUserTryouts(ctx, lastOwner.userId))
            )
          );
        }
        const repeatedAbort = yield* Effect.promise(() =>
          t.mutation((ctx) => runConvexProgram(abortProgram(ctx, releaseId)))
        );
        const stored = yield* Effect.promise(() =>
          t.query(async (ctx) => ({
            attempts: await ctx.db.query("tryoutAttempts").collect(),
            history: await ctx.db.query("tryoutAttemptHistory").collect(),
            runtime: await ctx.db.query("tryoutRuntimeBundles").collect(),
          }))
        );

        expect(firstAbort).toMatchObject({ complete: true, releaseId });
        expect(firstProgressed).toBe(false);
        expect(retained.attempt).not.toBeNull();
        expect(retained.runtime).toHaveLength(1);
        expect(lastProgressed).toBe(false);
        expect(repeatedAbort).toMatchObject({ complete: true, releaseId });
        expect(stored).toEqual({ attempts: [], history: [], runtime: [] });
      })
  );
});
