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

const RETAINED_RELEASE_PREFIX = /^retained-history-/;
const SHA256_PREFIX = /^sha256:/;

describe("tryouts/history/finalize", () => {
  it("atomically creates exact markers and proves idempotent completion", async () => {
    const t = convexTest(schema, convexModules);
    const result = await t.mutation(async (ctx) => {
      const fixture = await seedRetainedTryoutHistory(ctx);
      await prepareRetainedTryoutHistory(ctx, fixture);
      const first = await runConvexProgram(
        provideHistoryTestTrust(
          finalizeRetainedTryoutHistory(ctx, fixture.plan)
        )
      );
      const mutableSource = [
        ...(await ctx.db.query("tryoutCatalog").collect()),
        ...(await ctx.db.query("tryoutPlacements").collect()),
      ];
      for (const row of mutableSource) {
        await ctx.db.delete(row._id);
      }
      const second = await runConvexProgram(
        provideHistoryTestTrust(
          finalizeRetainedTryoutHistory(ctx, fixture.plan)
        )
      );
      const proof = await runConvexProgram(
        proveRetainedHistoryMarkers(ctx, fixture.plan)
      );
      const markers = await ctx.db.query("tryoutAttemptHistory").collect();
      return { first, markers, proof, second };
    });

    const expected = {
      attempts: 2,
      catalogRows: 2,
      frozenPlacements: 2,
      markers: 2,
      placementRows: 2,
      progressRows: 1,
      snapshotId: expect.stringMatching(SHA256_PREFIX),
    };
    expect(result.first).toEqual(expected);
    expect(result.second).toEqual(expected);
    expect(result.proof).toEqual(expected);
    expect(result.markers).toHaveLength(2);
    expect(result.markers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          snapshotReleaseId: expect.stringMatching(RETAINED_RELEASE_PREFIX),
          tryoutSnapshotId: expect.stringMatching(SHA256_PREFIX),
        }),
      ])
    );
  });

  it("rolls back marker insertion when appLocale is incomplete", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.mutation(async (ctx) => {
        const fixture = await seedRetainedTryoutHistory(ctx);
        await runConvexProgram(
          provideHistoryTestTrust(
            finalizeRetainedTryoutHistory(ctx, fixture.plan)
          )
        );
      })
    ).rejects.toMatchObject({
      data: { code: "TRYOUT_HISTORY_NOT_READY" },
    });
    const markers = await t.query((ctx) =>
      ctx.db.query("tryoutAttemptHistory").collect()
    );
    expect(markers).toEqual([]);
  });
});
