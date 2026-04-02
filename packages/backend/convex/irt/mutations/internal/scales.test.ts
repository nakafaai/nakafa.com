import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";

describe("irt/mutations/internal/scales", () => {
  it("cleans publication queue rows even when refresh is already queued", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 3, 2, 11, 0, 0)));

    const t = convexTest(schema, convexModules);

    const tryoutId = await t.mutation(async (ctx) => {
      const tryoutId = await ctx.db.insert("tryouts", {
        product: "snbt",
        locale: "id",
        cycleKey: "2026",
        slug: "snbt-2026-tryout-1",
        label: "SNBT 2026 Tryout 1",
        partCount: 0,
        totalQuestionCount: 0,
        isActive: true,
        detectedAt: Date.now(),
        syncedAt: Date.now(),
      });

      await ctx.db.insert("irtScalePublicationQueue", {
        tryoutId,
        enqueuedAt: Date.now() - 1000,
      });
      await ctx.db.insert("irtScaleQualityRefreshQueue", {
        tryoutId,
        enqueuedAt: Date.now() - 500,
      });

      return tryoutId;
    });

    await t.mutation(
      internal.irt.mutations.internal.scales.drainScalePublicationQueue,
      {}
    );
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const result = await t.query(async (ctx) => {
      return {
        publicationEntries: await ctx.db
          .query("irtScalePublicationQueue")
          .withIndex("by_tryoutId_and_enqueuedAt", (q) =>
            q.eq("tryoutId", tryoutId)
          )
          .collect(),
        qualityCheck: await ctx.db
          .query("irtScaleQualityChecks")
          .withIndex("by_tryoutId", (q) => q.eq("tryoutId", tryoutId))
          .unique(),
      };
    });

    expect(result.publicationEntries).toHaveLength(0);
    expect(result.qualityCheck).toMatchObject({
      tryoutId,
      status: "blocked",
      blockingReason: "insufficient-live-attempts",
      totalQuestionCount: 0,
      calibratedQuestionCount: 0,
      staleQuestionCount: 0,
      minAttemptCount: 0,
    });

    vi.useRealTimers();
  });
});
