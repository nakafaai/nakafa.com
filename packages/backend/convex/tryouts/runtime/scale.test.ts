import { assert, describe, expect, it } from "@effect/vitest";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { cleanupAttemptScale } from "@repo/backend/convex/tryouts/runtime/scale";
import { seedTryoutContentAccessState } from "@repo/backend/test/tryout/runtime";
import { Effect } from "effect";

/** Seeds one attempt-owned historical scale graph. */
function seedAttemptScale(
  suffix: string,
  counts: { readonly items: number; readonly runs: number } = {
    items: 1,
    runs: 1,
  }
) {
  return async (ctx: MutationCtx) => {
    const runtime = await seedTryoutContentAccessState(ctx, {
      attemptStatus: "completed",
      sectionStatus: "completed",
      suffix,
    });
    const scaleVersionId = await ctx.db.insert("irtScaleVersions", {
      history: true,
      model: "2pl",
      publishedAt: 1,
      questionCount: counts.items,
      setIdentity: `set:${suffix}`,
      status: "official",
      tryoutSnapshotId: `snapshot:${suffix}`,
    });
    const runIds: Id<"irtCalibrationRuns">[] = [];
    for (let index = 0; index < counts.runs; index += 1) {
      runIds.push(
        await ctx.db.insert("irtCalibrationRuns", {
          attemptCount: 1,
          iterationCount: 1,
          maxParameterDelta: 0,
          model: "2pl",
          questionCount: counts.items,
          responseCount: 1,
          scaleVersionId,
          sectionIdentity: `section:${suffix}:${index}`,
          startedAt: index,
          status: "completed",
          updatedAt: index,
        })
      );
    }
    const firstRunId = runIds[0];
    assert.ok(firstRunId);
    for (let index = 0; index < counts.items; index += 1) {
      await ctx.db.insert("irtScaleItems", {
        calibrationRunId: runIds[index % runIds.length] ?? firstRunId,
        calibrationStatus: "calibrated",
        correctRate: 1,
        difficulty: 0,
        discrimination: 1,
        placementIdentity: `placement:${suffix}:${index}`,
        placementRowHash: `sha256:${index.toString(16).padStart(64, "0")}`,
        responseCount: 1,
        scaleVersionId,
      });
    }
    await ctx.db.patch("tryoutAttempts", runtime.attemptId, {
      scaleVersionId,
    });
    const attempt = await ctx.db.get(runtime.attemptId);
    assert.ok(attempt);
    return { attempt, scaleVersionId };
  };
}

describe("tryouts/runtime/scale", () => {
  it.effect("deletes every child page before deleting an owned scale", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      const seeded = yield* Effect.promise(() =>
        t.mutation(seedAttemptScale("bounded-cleanup", { items: 33, runs: 33 }))
      );
      const progress: boolean[] = [];

      for (let page = 0; page < 8; page += 1) {
        const attempt = yield* Effect.promise(() =>
          t.query((ctx) => ctx.db.get(seeded.attempt._id))
        );
        assert.ok(attempt);
        const changed = yield* Effect.promise(() =>
          t.mutation((ctx) =>
            runConvexProgram(cleanupAttemptScale(ctx, attempt))
          )
        );
        progress.push(changed);
        if (!changed) {
          break;
        }
      }

      expect(progress).toEqual([true, true, true, true, true, false]);
      const state = yield* Effect.promise(() =>
        t.query(async (ctx) => ({
          attempt: await ctx.db.get(seeded.attempt._id),
          items: await ctx.db.query("irtScaleItems").collect(),
          runs: await ctx.db.query("irtCalibrationRuns").collect(),
          scale: await ctx.db.get(seeded.scaleVersionId),
        }))
      );
      expect(state).toMatchObject({ items: [], runs: [], scale: null });
      expect(state.attempt?.scaleVersionId).toBeUndefined();
    })
  );

  it.effect("preserves a scale shared by another attempt", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      const seeded = yield* Effect.promise(() =>
        t.mutation(seedAttemptScale("shared-attempt"))
      );
      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const {
            _creationTime: _createdAt,
            _id: _attemptId,
            ...attempt
          } = seeded.attempt;
          await ctx.db.insert("tryoutAttempts", {
            ...attempt,
            attemptNumber: 2,
          });
        })
      );

      const changed = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          runConvexProgram(cleanupAttemptScale(ctx, seeded.attempt))
        )
      );
      expect(changed).toBe(false);
      yield* Effect.promise(() =>
        expect(
          t.query((ctx) => ctx.db.get(seeded.scaleVersionId))
        ).resolves.not.toBeNull()
      );
    })
  );

  it.effect("preserves a scale referenced by an immutable score", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      const seeded = yield* Effect.promise(() =>
        t.mutation(seedAttemptScale("shared-score"))
      );
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          ctx.db.insert("tryoutScores", {
            finalizedAt: 1,
            publishedScore: 100,
            rawScore: 100,
            scaleVersionId: seeded.scaleVersionId,
            scoreStatus: "official",
            scoringStrategy: "irt",
            setIdentity: seeded.attempt.setIdentity,
            theta: 1,
            thetaSE: 0,
            totalCorrect: 1,
            totalQuestions: 1,
            tryoutAttemptId: seeded.attempt._id,
            tryoutSnapshotId: seeded.attempt.tryoutSnapshotId,
            userId: seeded.attempt.userId,
          })
        )
      );

      yield* Effect.promise(() =>
        expect(
          t.mutation((ctx) =>
            runConvexProgram(cleanupAttemptScale(ctx, seeded.attempt))
          )
        ).resolves.toBe(false)
      );
    })
  );

  it.effect("ignores current scales and rejects a missing owned scale", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      const attempt = yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const runtime = await seedTryoutContentAccessState(ctx, {
            attemptStatus: "completed",
            sectionStatus: "completed",
            suffix: "current-scale",
          });
          const stored = await ctx.db.get(runtime.attemptId);
          assert.ok(stored);
          return stored;
        })
      );
      yield* Effect.promise(() =>
        expect(
          t.mutation((ctx) =>
            runConvexProgram(cleanupAttemptScale(ctx, attempt))
          )
        ).resolves.toBe(false)
      );
      const current = yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const scaleVersionId = await ctx.db.insert("irtScaleVersions", {
            model: "2pl",
            publishedAt: 1,
            questionCount: 1,
            setIdentity: "set:current-scale",
            status: "official",
            tryoutSnapshotId: "snapshot:current-scale",
          });
          await ctx.db.patch("tryoutAttempts", attempt._id, { scaleVersionId });
          const stored = await ctx.db.get(attempt._id);
          assert.ok(stored);
          return { attempt: stored, scaleVersionId };
        })
      );
      yield* Effect.promise(() =>
        expect(
          t.mutation((ctx) =>
            runConvexProgram(cleanupAttemptScale(ctx, current.attempt))
          )
        ).resolves.toBe(false)
      );
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          ctx.db.delete("irtScaleVersions", current.scaleVersionId)
        )
      );
      yield* Effect.promise(() =>
        expect(
          t.mutation((ctx) =>
            runConvexProgram(cleanupAttemptScale(ctx, current.attempt))
          )
        ).rejects.toMatchObject({
          data: { code: "TRYOUT_HISTORY_SCALE_MISSING" },
        })
      );
    })
  );
});
