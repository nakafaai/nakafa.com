import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { authenticateRetainedTryoutHistory } from "@repo/backend/convex/tryouts/history/authentication";
import { verifyRetainedHistoryReadiness } from "@repo/backend/convex/tryouts/history/readiness";
import {
  prepareRetainedTryoutHistory,
  provideHistoryTestTrust,
  seedRetainedTryoutHistory,
} from "@repo/backend/test/tryout-history";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("tryouts/history/readiness", () => {
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
