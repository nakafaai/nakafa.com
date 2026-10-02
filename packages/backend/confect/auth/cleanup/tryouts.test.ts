import { RegisteredConvexFunction } from "@confect/server";
import { assert, describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { writeTryoutSetProgress } from "@repo/backend/confect/tryouts/progress/write";
import { internal } from "@repo/backend/convex/_generated/api";
import { seedTryoutContentAccessState } from "@repo/backend/test/tryout/runtime";
import { Effect } from "effect";

describe("auth/cleanup/tryouts", () => {
  it.effect("deletes the last attempt and its attempt-only scale", () =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
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
          const attempt = await ctx.db.get("tryoutAttempts", runtime.attemptId);
          assert.ok(attempt);
          await Effect.runPromiseWith(runtimeServices)(
            writeTryoutSetProgress({
              attempt,
              publishedScore: 100,
              status: "completed",
              updatedAt: attempt.lastActivityAt,
            }).pipe(
              Effect.provide(
                RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
              )
            )
          );
          await ctx.db.insert("tryoutResponses", {
            answeredAt: 1,
            isComplete: true,
            isCorrect: true,
            placementId: runtime.placementId,
            selection: {
              kind: "single-choice",
              optionKey: "option-1",
            },
            timeSpent: 1,
            tryoutAttemptId: attempt._id,
            tryoutSectionAttemptId: runtime.sectionAttemptId,
            updatedAt: 1,
          });
          await ctx.db.insert("tryoutScores", {
            finalizedAt: 1,
            publishedScore: 100,
            rawScore: 1,
            scaleVersionId,
            scoreStatus: "official",
            scoringStrategy: "irt",
            setIdentity: attempt.setIdentity,
            totalCorrect: 1,
            totalQuestions: 1,
            tryoutAttemptId: attempt._id,
            tryoutSnapshotId: attempt.tryoutSnapshotId,
            userId: attempt.userId,
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
          t.mutation(internal.auth.cleanup.cleanupDeletedUser, {
            userId: seeded.userId,
          })
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
  it.effect("deletes review flags before their section attempt", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      const seeded = yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const runtime = await seedTryoutContentAccessState(ctx, {
            attemptStatus: "completed",
            sectionStatus: "completed",
            suffix: "cleanup-flags",
          });
          await ctx.db.insert("tryoutFlags", {
            flaggedAt: 1,
            placementId: runtime.placementId,
            tryoutAttemptId: runtime.attemptId,
            tryoutSectionAttemptId: runtime.sectionAttemptId,
          });
          return runtime;
        })
      );
      let progressed = true;
      for (let page = 0; page < 16 && progressed; page += 1) {
        progressed = yield* Effect.promise(() =>
          t.mutation(internal.auth.cleanup.cleanupDeletedUser, {
            userId: seeded.identity.userId,
          })
        );
      }
      expect(progressed).toBe(false);
      const state = yield* Effect.promise(() =>
        t.query(async (ctx) => ({
          attempt: await ctx.db.get(seeded.attemptId),
          flags: await ctx.db.query("tryoutFlags").collect(),
          section: await ctx.db.get(seeded.sectionAttemptId),
        }))
      );
      expect(state).toEqual({
        attempt: null,
        flags: [],
        section: null,
      });
    })
  );
});
