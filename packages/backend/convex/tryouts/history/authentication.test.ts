import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { authenticateRetainedTryoutHistory } from "@repo/backend/convex/tryouts/history/authentication";
import {
  provideHistoryTestTrust,
  seedRetainedTryoutHistory,
} from "@repo/backend/test/tryout-history";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const SHA256_PREFIX = /^sha256:/;

describe("tryouts/history/authentication", () => {
  it("authenticates retained relative paths and assessed artifact locales", async () => {
    const t = convexTest(schema, convexModules);
    const result = await t.mutation(async (ctx) => {
      const fixture = await seedRetainedTryoutHistory(ctx);
      const inventory = await runConvexProgram(
        provideHistoryTestTrust(
          authenticateRetainedTryoutHistory(ctx, fixture.plan)
        )
      );
      return {
        attempts: inventory.attempts.length,
        bundles: inventory.bundles.length,
        placements: inventory.frozenPlacements.length,
        progress: inventory.progressRows.length,
        snapshotId: inventory.snapshot.snapshotId,
      };
    });

    expect(result).toEqual({
      attempts: 2,
      bundles: 2,
      placements: 2,
      progress: 1,
      snapshotId: expect.stringMatching(SHA256_PREFIX),
    });
  });

  it("fails closed when a retained bundle loses its manifest identity", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.mutation(async (ctx) => {
        const fixture = await seedRetainedTryoutHistory(ctx);
        const bundle = await ctx.db.query("tryoutBundles").first();
        if (!bundle) {
          throw new Error("Expected retained bundle fixture.");
        }
        await ctx.db.patch(bundle._id, {
          manifestHash: `sha256:${"f".repeat(64)}`,
        });
        await runConvexProgram(
          provideHistoryTestTrust(
            authenticateRetainedTryoutHistory(ctx, fixture.plan)
          )
        );
      })
    ).rejects.toMatchObject({
      data: { code: "TRYOUT_HISTORY_INTEGRITY" },
    });
  });
});
