import { internal } from "@repo/backend/convex/_generated/api";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import {
  makeTryoutMigrationArgs,
  seedTryoutMigration,
} from "@repo/backend/test/tryout-migration";
import { describe, expect, it } from "vitest";

describe("tryouts/migrations/score", () => {
  it("prepares terminal scoring before the attempt root activates", async () => {
    const t = createConvexTestWithBetterAuth();
    const { snapshotId } = await t.mutation(seedTryoutMigration);
    const args = makeTryoutMigrationArgs(snapshotId);

    await t.mutation(internal.tryouts.migrations.attempt.migrateAttempts, args);
    await t.mutation(internal.tryouts.migrations.item.migrateItems, args);
    await t.mutation(internal.tryouts.migrations.scale.migrateScales, args);

    await expect(
      t.mutation(internal.tryouts.migrations.score.migrateScores, args)
    ).resolves.toMatchObject({ changed: 1, isDone: true });
    await expect(
      t.run((ctx) => ctx.db.query("tryoutAttempts").unique())
    ).resolves.not.toHaveProperty("tryoutSnapshotId");
    await expect(
      t.run((ctx) => ctx.db.query("tryoutScores").unique())
    ).resolves.toMatchObject({
      scaleVersionId: expect.any(String),
      setIdentity: expect.any(String),
      tryoutSnapshotId: snapshotId,
    });
  });
});
