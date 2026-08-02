import { internal } from "@repo/backend/convex/_generated/api";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import {
  makeTryoutMigrationArgs,
  seedTryoutMigration,
} from "@repo/backend/test/tryout-migration";
import { describe, expect, it } from "vitest";

describe("tryouts/migrations/placement", () => {
  it("binds a frozen placement after its mutable source diverges", async () => {
    const t = createConvexTestWithBetterAuth();
    const { placementId, questionId, snapshotId } =
      await t.mutation(seedTryoutMigration);
    const args = makeTryoutMigrationArgs(snapshotId);

    await t.mutation(internal.tryouts.migrations.attempt.migrateAttempts, args);

    await t.run((ctx) =>
      ctx.db.patch(questionId, { contentHash: "changed-after-attempt" })
    );

    await expect(
      t.mutation(internal.tryouts.migrations.placement.migratePlacements, args)
    ).resolves.toMatchObject({ changed: 1, isDone: true });
    await expect(
      t.run((ctx) => ctx.db.get(placementId))
    ).resolves.toMatchObject({ placementIdentity: expect.any(String) });
  });

  it("rejects a conflicting signed placement identity", async () => {
    const t = createConvexTestWithBetterAuth();
    const { placementId, snapshotId } = await t.mutation(seedTryoutMigration);
    const args = makeTryoutMigrationArgs(snapshotId);

    await t.mutation(internal.tryouts.migrations.attempt.migrateAttempts, args);

    await t.run((ctx) =>
      ctx.db.patch(placementId, { placementIdentity: "conflicting" })
    );

    await expect(
      t.mutation(internal.tryouts.migrations.placement.migratePlacements, args)
    ).rejects.toThrow("conflicts with its signed artifact identity");
  });

  it("rejects matching legacy hashes that differ from signed content", async () => {
    const t = createConvexTestWithBetterAuth();
    const { placementId, snapshotId } = await t.mutation(seedTryoutMigration);
    const alteredContentHash = "5".repeat(64);
    const args = makeTryoutMigrationArgs(snapshotId);

    await t.mutation(internal.tryouts.migrations.attempt.migrateAttempts, args);

    await t.run((ctx) =>
      ctx.db.patch(placementId, { contentHash: alteredContentHash })
    );

    await expect(
      t.mutation(internal.tryouts.migrations.placement.migratePlacements, args)
    ).rejects.toThrow("differs from its signed row");
  });
});
