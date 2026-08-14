import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { authenticateRetainedTryoutHistory } from "@repo/backend/convex/tryouts/history/authentication";
import { finalizeRetainedTryoutHistory } from "@repo/backend/convex/tryouts/history/finalize";
import {
  proveRetainedHistoryComplete,
  verifyRetainedHistoryReadiness,
} from "@repo/backend/convex/tryouts/history/readiness";
import {
  prepareRetainedTryoutHistory,
  provideHistoryTestTrust,
  seedRetainedTryoutHistory,
} from "@repo/backend/test/tryout-history";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("tryouts/history/readiness", () => {
  it("does not report completion before exact markers exist", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.mutation(async (ctx) => {
        const fixture = await seedRetainedTryoutHistory(ctx);
        await prepareRetainedTryoutHistory(ctx, fixture);
        await runConvexProgram(
          provideHistoryTestTrust(
            proveRetainedHistoryComplete(ctx, fixture.plan)
          )
        );
      })
    ).rejects.toMatchObject({
      data: { code: "TRYOUT_HISTORY_NOT_READY" },
    });
  });

  it("proves completed history after mutable source rows are drained", async () => {
    const t = convexTest(schema, convexModules);
    const result = await t.mutation(async (ctx) => {
      const fixture = await seedRetainedTryoutHistory(ctx);
      await prepareRetainedTryoutHistory(ctx, fixture);
      await runConvexProgram(
        provideHistoryTestTrust(
          finalizeRetainedTryoutHistory(ctx, fixture.plan)
        )
      );
      const sourceRows = [
        ...(await ctx.db.query("tryoutCatalog").collect()),
        ...(await ctx.db.query("tryoutPlacements").collect()),
      ];
      for (const row of sourceRows) {
        await ctx.db.delete(row._id);
      }
      return runConvexProgram(
        provideHistoryTestTrust(proveRetainedHistoryComplete(ctx, fixture.plan))
      );
    });

    expect(result).toMatchObject({
      attempts: 2,
      catalogRows: 2,
      frozenPlacements: 2,
      markers: 2,
      placementRows: 2,
      progressRows: 1,
    });
  });

  it("keeps the pre-drain gate fail-closed on partial source inventory", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.mutation(async (ctx) => {
        const fixture = await seedRetainedTryoutHistory(ctx);
        await prepareRetainedTryoutHistory(ctx, fixture);
        const source = await ctx.db.query("tryoutCatalog").first();
        if (!source) {
          throw new Error("Expected retained catalog source fixture.");
        }
        await ctx.db.delete(source._id);
        const inventory = await runConvexProgram(
          provideHistoryTestTrust(
            authenticateRetainedTryoutHistory(ctx, fixture.plan)
          )
        );
        await runConvexProgram(
          verifyRetainedHistoryReadiness(ctx, inventory, fixture.plan)
        );
      })
    ).rejects.toMatchObject({
      data: { code: "TRYOUT_HISTORY_NOT_READY" },
    });
  });
});
