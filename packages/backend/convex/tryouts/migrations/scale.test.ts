import { internal } from "@repo/backend/convex/_generated/api";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import {
  makeTryoutMigrationArgs,
  seedTryoutMigration,
} from "@repo/backend/test/tryout-migration";
import { describe, expect, it } from "vitest";

describe("tryouts/migrations/scale", () => {
  it("binds a scale only after every item has signed placement proof", async () => {
    const t = createConvexTestWithBetterAuth();
    const { snapshotId } = await t.mutation(seedTryoutMigration);
    const args = makeTryoutMigrationArgs(snapshotId);

    await expect(
      t.mutation(internal.tryouts.migrations.scale.migrateScales, args)
    ).rejects.toThrow("An IRT scale cannot bind before every item is prepared");
    await t.mutation(internal.tryouts.migrations.item.migrateItems, args);
    await expect(
      t.mutation(internal.tryouts.migrations.scale.migrateScales, args)
    ).resolves.toMatchObject({ changed: 1, isDone: true });
  });

  it("rejects a conflicting signed scale identity", async () => {
    const t = createConvexTestWithBetterAuth();
    const { snapshotId } = await t.mutation(seedTryoutMigration);
    await t.run(async (ctx) => {
      const scale = await ctx.db.query("irtScaleVersions").unique();
      if (!scale) {
        throw new Error("Expected one technical scale version.");
      }
      await ctx.db.patch(scale._id, { tryoutSnapshotId: "conflicting" });
    });

    await expect(
      t.mutation(
        internal.tryouts.migrations.item.migrateItems,
        makeTryoutMigrationArgs(snapshotId)
      )
    ).rejects.toThrow("conflicts with its signed snapshot identity");
  });

  it("rejects matching IRT hashes that differ from signed content", async () => {
    const t = createConvexTestWithBetterAuth();
    const { irtItemId, questionId, snapshotId } =
      await t.mutation(seedTryoutMigration);
    const alteredContentHash = "6".repeat(64);

    await t.run(async (ctx) => {
      await ctx.db.patch(questionId, { contentHash: alteredContentHash });
      await ctx.db.patch(irtItemId, { contentHash: alteredContentHash });
    });

    await expect(
      t.mutation(
        internal.tryouts.migrations.item.migrateItems,
        makeTryoutMigrationArgs(snapshotId)
      )
    ).rejects.toThrow("differs from its signed placement");
  });
});
