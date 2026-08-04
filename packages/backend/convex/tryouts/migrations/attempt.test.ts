import { internal } from "@repo/backend/convex/_generated/api";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import {
  makeTryoutMigrationArgs,
  seedTryoutMigration,
} from "@repo/backend/test/tryout-migration";
import { describe, expect, it } from "vitest";

describe("tryouts/migrations/attempt", () => {
  it("repairs source-derived fields without replacing a signed identity", async () => {
    const t = createConvexTestWithBetterAuth();
    const { snapshotId } = await t.mutation(seedTryoutMigration);
    const args = makeTryoutMigrationArgs(snapshotId);

    await t.mutation(internal.tryouts.migrations.attempt.migrateAttempts, args);
    await t.run(async (ctx) => {
      const attempt = await ctx.db.query("tryoutAttempts").unique();
      if (!attempt) {
        throw new Error("Expected one migrated technical attempt.");
      }
      await ctx.db.patch(attempt._id, { countryKey: "changed" });
    });

    await expect(
      t.mutation(internal.tryouts.migrations.attempt.migrateAttempts, args)
    ).resolves.toMatchObject({ changed: 1, isDone: true });

    await t.run(async (ctx) => {
      const attempt = await ctx.db.query("tryoutAttempts").unique();
      if (!attempt) {
        throw new Error("Expected one migrated technical attempt.");
      }
      await ctx.db.patch(attempt._id, { setIdentity: "conflicting" });
    });
    await expect(
      t.mutation(internal.tryouts.migrations.attempt.migrateAttempts, args)
    ).rejects.toThrow("conflicts with its signed snapshot identity");
  });

  it("rejects a frozen section after its legacy source diverges", async () => {
    const t = createConvexTestWithBetterAuth();
    const { snapshotId, tryoutSectionId } =
      await t.mutation(seedTryoutMigration);

    await t.run((ctx) =>
      ctx.db.patch(tryoutSectionId, { sourceRevision: "changed-after-attempt" })
    );

    await expect(
      t.mutation(
        internal.tryouts.migrations.attempt.migrateAttempts,
        makeTryoutMigrationArgs(snapshotId)
      )
    ).rejects.toThrow("Legacy try-out section");
  });

  it("rejects legacy section metadata drift", async () => {
    const t = createConvexTestWithBetterAuth();
    const { snapshotId, tryoutSectionId } =
      await t.mutation(seedTryoutMigration);

    await t.run((ctx) =>
      ctx.db.patch(tryoutSectionId, { title: "Changed after publication" })
    );

    await expect(
      t.mutation(
        internal.tryouts.migrations.attempt.migrateAttempts,
        makeTryoutMigrationArgs(snapshotId)
      )
    ).rejects.toThrow("Legacy try-out section");
  });
});
