import { internal } from "@repo/backend/convex/_generated/api";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import {
  makeTryoutMigrationArgs,
  seedTryoutMigration,
} from "@repo/backend/test/tryout-migration";
import { describe, expect, it } from "vitest";

describe("tryouts/migrations/placement", () => {
  it("rejects a frozen placement after its legacy source diverges", async () => {
    const t = createConvexTestWithBetterAuth();
    const { questionId, snapshotId } = await t.mutation(seedTryoutMigration);

    await t.run((ctx) =>
      ctx.db.patch(questionId, { contentHash: "changed-after-attempt" })
    );

    await expect(
      t.mutation(
        internal.tryouts.migrations.placement.migratePlacements,
        makeTryoutMigrationArgs(snapshotId)
      )
    ).rejects.toThrow(
      "A frozen legacy placement differs from its source question"
    );
  });

  it("rejects a conflicting signed placement identity", async () => {
    const t = createConvexTestWithBetterAuth();
    const { placementId, snapshotId } = await t.mutation(seedTryoutMigration);

    await t.run((ctx) =>
      ctx.db.patch(placementId, { placementIdentity: "conflicting" })
    );

    await expect(
      t.mutation(
        internal.tryouts.migrations.placement.migratePlacements,
        makeTryoutMigrationArgs(snapshotId)
      )
    ).rejects.toThrow("conflicts with its signed artifact identity");
  });

  it("rejects matching legacy hashes that differ from signed content", async () => {
    const t = createConvexTestWithBetterAuth();
    const { placementId, questionId, snapshotId } =
      await t.mutation(seedTryoutMigration);
    const alteredContentHash = "5".repeat(64);

    await t.run(async (ctx) => {
      await ctx.db.patch(questionId, { contentHash: alteredContentHash });
      await ctx.db.patch(placementId, { contentHash: alteredContentHash });
    });

    await expect(
      t.mutation(
        internal.tryouts.migrations.placement.migratePlacements,
        makeTryoutMigrationArgs(snapshotId)
      )
    ).rejects.toThrow("differs from its signed row");
  });
});
