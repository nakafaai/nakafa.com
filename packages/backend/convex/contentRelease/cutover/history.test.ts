import { proveFreezeHistory } from "@repo/backend/convex/contentRelease/cutover/history";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { finalizeRetainedTryoutHistory } from "@repo/backend/convex/tryouts/history/finalize";
import {
  prepareRetainedTryoutHistory,
  provideHistoryTestTrust,
  seedRetainedTryoutHistory,
} from "@repo/backend/test/tryout-history";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("contentRelease/cutover/history", () => {
  it("proves the pre-drain source and immutable marker boundary", async () => {
    const t = convexTest(schema, convexModules);
    const result = await t.mutation(async (ctx) => {
      const fixture = await seedRetainedTryoutHistory(ctx);
      await prepareRetainedTryoutHistory(ctx, fixture);
      await runConvexProgram(
        provideHistoryTestTrust(
          finalizeRetainedTryoutHistory(ctx, fixture.plan)
        )
      );
      return runConvexProgram(
        provideHistoryTestTrust(proveFreezeHistory(ctx, fixture.plan))
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
});
