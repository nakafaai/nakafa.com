import { internal } from "@repo/backend/convex/_generated/api";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { finalizeAttemptScore } from "@repo/backend/convex/tryouts/runtime/score";
import {
  makeTryoutMigrationArgs,
  seedTryoutMigration,
} from "@repo/backend/test/tryout-migration";
import { describe, expect, it } from "vitest";

describe("tryouts/migrations/activate", () => {
  it("keeps local ownership until placements and scoring are prepared", async () => {
    const t = createConvexTestWithBetterAuth();
    const { snapshotId } = await t.mutation(seedTryoutMigration);
    const args = makeTryoutMigrationArgs(snapshotId);

    await t.mutation(internal.tryouts.migrations.attempt.migrateAttempts, args);
    await expect(
      t.run((ctx) => ctx.db.query("tryoutAttempts").unique())
    ).resolves.not.toHaveProperty("tryoutSnapshotId");
    await expect(
      t.mutation(internal.tryouts.migrations.activate.activateAttempts, args)
    ).rejects.toThrow("before every placement is prepared");

    await t.mutation(
      internal.tryouts.migrations.placement.migratePlacements,
      args
    );
    await t.mutation(async (ctx) => {
      const attempt = await ctx.db.query("tryoutAttempts").unique();
      const score = await ctx.db.query("tryoutScores").unique();
      if (!(attempt && score)) {
        throw new Error("Expected one migratable attempt and score.");
      }
      await ctx.db.delete(score._id);
      await ctx.db.patch(attempt._id, {
        completedAt: null,
        endReason: null,
        status: "in-progress",
      });
      const activeAttempt = await ctx.db.get(attempt._id);
      if (!activeAttempt) {
        throw new Error("Expected the active migration attempt.");
      }
      await runConvexProgram(
        finalizeAttemptScore(ctx, {
          attempt: activeAttempt,
          endReason: "submitted",
          now: activeAttempt.lastActivityAt + 1,
        })
      );
    });
    await expect(
      t.mutation(internal.tryouts.migrations.activate.activateAttempts, args)
    ).rejects.toThrow("before its scale is prepared");

    await t.mutation(internal.tryouts.migrations.item.migrateItems, args);
    await t.mutation(internal.tryouts.migrations.scale.migrateScales, args);
    await expect(
      t.mutation(internal.tryouts.migrations.activate.activateAttempts, args)
    ).rejects.toThrow("before its score is prepared");
    await t.mutation(internal.tryouts.migrations.score.migrateScores, args);
    await expect(
      t.mutation(internal.tryouts.migrations.activate.activateAttempts, args)
    ).resolves.toMatchObject({ changed: 1, isDone: true });
    await expect(
      t.run((ctx) => ctx.db.query("tryoutAttempts").unique())
    ).resolves.toMatchObject({
      scaleVersionId: expect.any(String),
      tryoutSnapshotId: snapshotId,
    });
    await expect(
      t.mutation(internal.tryouts.migrations.activate.activateAttempts, args)
    ).resolves.toMatchObject({ changed: 0, isDone: true });
  });

  it("keeps raw attempt activation retry-safe without a scale", async () => {
    const t = createConvexTestWithBetterAuth();
    const { snapshotId } = await t.mutation(seedTryoutMigration);
    const args = makeTryoutMigrationArgs(snapshotId);

    await t.mutation(internal.tryouts.migrations.attempt.migrateAttempts, args);
    await t.mutation(
      internal.tryouts.migrations.placement.migratePlacements,
      args
    );
    await t.mutation(async (ctx) => {
      const attempt = await ctx.db.query("tryoutAttempts").unique();
      const score = await ctx.db.query("tryoutScores").unique();
      if (!(attempt && score)) {
        throw new Error("Expected one migratable attempt and score.");
      }
      await ctx.db.patch(attempt._id, { scoringStrategy: "raw" });
      await ctx.db.patch(score._id, { scoringStrategy: "raw" });
    });
    await t.mutation(internal.tryouts.migrations.score.migrateScores, args);

    await expect(
      t.mutation(internal.tryouts.migrations.activate.activateAttempts, args)
    ).resolves.toMatchObject({ changed: 1, isDone: true });
    await expect(
      t.mutation(internal.tryouts.migrations.activate.activateAttempts, args)
    ).resolves.toMatchObject({ changed: 0, isDone: true });
  });
});
