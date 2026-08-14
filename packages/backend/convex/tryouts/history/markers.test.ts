import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { finalizeRetainedTryoutHistory } from "@repo/backend/convex/tryouts/history/finalize";
import { proveRetainedHistoryMarkers } from "@repo/backend/convex/tryouts/history/markers";
import {
  prepareRetainedTryoutHistory,
  provideHistoryTestTrust,
  seedRetainedTryoutHistory,
} from "@repo/backend/test/tryout-history";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("tryouts/history/markers", () => {
  it("proves the compact atomic marker witness", async () => {
    const t = convexTest(schema, convexModules);
    const proof = await t.mutation(async (ctx) => {
      const fixture = await seedRetainedTryoutHistory(ctx);
      await prepareRetainedTryoutHistory(ctx, fixture);
      await runConvexProgram(
        provideHistoryTestTrust(
          finalizeRetainedTryoutHistory(ctx, fixture.plan)
        )
      );
      return runConvexProgram(proveRetainedHistoryMarkers(ctx, fixture.plan));
    });

    expect(proof).toMatchObject({
      attempts: 2,
      frozenPlacements: 2,
      markers: 2,
    });
  });

  it("rejects an attempt changed after marker creation", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.mutation(async (ctx) => {
        const fixture = await seedRetainedTryoutHistory(ctx);
        await prepareRetainedTryoutHistory(ctx, fixture);
        await runConvexProgram(
          provideHistoryTestTrust(
            finalizeRetainedTryoutHistory(ctx, fixture.plan)
          )
        );
        const attempt = await ctx.db.query("tryoutAttempts").first();
        if (!attempt) {
          throw new Error("Expected one retained attempt fixture.");
        }
        await ctx.db.patch("tryoutAttempts", attempt._id, {
          appLocale: attempt.locale === "en" ? "id" : "en",
        });
        return runConvexProgram(proveRetainedHistoryMarkers(ctx, fixture.plan));
      })
    ).rejects.toMatchObject({
      data: { code: "TRYOUT_HISTORY_INTEGRITY" },
    });
  });
});
