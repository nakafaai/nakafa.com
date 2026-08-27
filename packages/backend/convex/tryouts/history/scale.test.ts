import { assert, describe, expect, it } from "@effect/vitest";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { cleanupTryoutHistoryScale } from "@repo/backend/convex/tryouts/history/scale";
import { seedTryoutContentAccessState } from "@repo/backend/test/tryout/runtime";
import { Effect } from "effect";

/** Seeds one history scale and assigns it to a standard completed attempt. */
function seedHistoryScale(suffix: string, itemCount = 1) {
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
      questionCount: itemCount,
      setIdentity: `set:${suffix}`,
      status: "official",
      tryoutSnapshotId: `snapshot:${suffix}`,
    });
    const runId = await ctx.db.insert("irtCalibrationRuns", {
      attemptCount: 1,
      iterationCount: 1,
      maxParameterDelta: 0,
      model: "2pl",
      questionCount: itemCount,
      responseCount: 1,
      scaleVersionId,
      sectionIdentity: `section:${suffix}`,
      startedAt: 1,
      status: "completed",
      updatedAt: 1,
    });
    for (let index = 0; index < itemCount; index += 1) {
      await ctx.db.insert("irtScaleItems", {
        calibrationRunId: runId,
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

describe("tryouts/history/scale", () => {
  it.effect("deletes an unreferenced history graph in bounded phases", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      const seeded = yield* Effect.promise(() =>
        t.mutation(seedHistoryScale("cleanup", 33))
      );
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          runConvexProgram(cleanupTryoutHistoryScale(ctx, seeded.attempt))
        )
      );
      yield* Effect.promise(() =>
        expect(
          t.query((ctx) => ctx.db.query("irtScaleItems").collect())
        ).resolves.toHaveLength(1)
      );
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          runConvexProgram(cleanupTryoutHistoryScale(ctx, seeded.attempt))
        )
      );
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          runConvexProgram(cleanupTryoutHistoryScale(ctx, seeded.attempt))
        )
      );
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          runConvexProgram(cleanupTryoutHistoryScale(ctx, seeded.attempt))
        )
      );

      const state = yield* Effect.promise(() =>
        t.query(async (ctx) => ({
          items: await ctx.db.query("irtScaleItems").collect(),
          runs: await ctx.db.query("irtCalibrationRuns").collect(),
          scale: await ctx.db.get(seeded.scaleVersionId),
        }))
      );
      expect(state).toEqual({ items: [], runs: [], scale: null });
    })
  );

  it.effect("preserves a history graph while another attempt owns it", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      const seeded = yield* Effect.promise(() =>
        t.mutation(seedHistoryScale("shared"))
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
            scaleVersionId: seeded.scaleVersionId,
          });
        })
      );

      const changed = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          runConvexProgram(cleanupTryoutHistoryScale(ctx, seeded.attempt))
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
});
