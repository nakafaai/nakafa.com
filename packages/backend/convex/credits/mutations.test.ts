import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";

describe("credits/mutations", () => {
  it("syncs one plan reset period to the current boundary", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 3, 2, 10, 0, 0)));

    const t = convexTest(schema, convexModules);

    await t.mutation(internal.credits.mutations.syncCreditResetPeriod, {
      plan: "free",
    });

    const storedPeriod = await t.query(async (ctx) => {
      return await ctx.db
        .query("creditResetPeriods")
        .withIndex("by_plan", (q) => q.eq("plan", "free"))
        .unique();
    });

    expect(storedPeriod).toMatchObject({
      plan: "free",
      resetAt: Date.UTC(2026, 3, 2, 0, 0, 0),
    });

    vi.useRealTimers();
  });

  it("syncs all credit reset periods", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 3, 18, 10, 0, 0)));

    const t = convexTest(schema, convexModules);

    await t.mutation(internal.credits.mutations.syncAllCreditResetPeriods, {});

    const storedPeriods = await t.query(async (ctx) => {
      return await ctx.db.query("creditResetPeriods").collect();
    });

    expect(storedPeriods).toHaveLength(2);
    expect(storedPeriods).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          plan: "free",
          resetAt: Date.UTC(2026, 3, 18, 0, 0, 0),
        }),
        expect.objectContaining({
          plan: "pro",
          resetAt: Date.UTC(2026, 3, 1, 0, 0, 0),
        }),
      ])
    );

    vi.useRealTimers();
  });
});
