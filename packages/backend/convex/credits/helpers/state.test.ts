import {
  getCreditResetGrantTransaction,
  getCurrentCreditResetTimestamp,
  getStoredCreditResetTimestamp,
  resolveCurrentCreditResetTimestamp,
  resolveEffectiveCreditState,
  upsertStoredCreditResetTimestamp,
} from "@repo/backend/convex/credits/helpers/state";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("credits/helpers/state", () => {
  it("returns null when no stored reset period exists", async () => {
    const t = convexTest(schema, convexModules);

    const resetTimestamp = await t.query(async (ctx) => {
      return await getStoredCreditResetTimestamp(ctx.db, "free");
    });

    expect(resetTimestamp).toBeNull();
  });

  it("inserts a stored reset period when one does not exist", async () => {
    const t = convexTest(schema, convexModules);
    const resetAt = Date.UTC(2026, 3, 1, 0, 0, 0);

    await t.mutation(async (ctx) => {
      await upsertStoredCreditResetTimestamp(ctx.db, "free", resetAt);
    });

    const storedPeriod = await t.query(async (ctx) => {
      return await ctx.db
        .query("creditResetPeriods")
        .withIndex("by_plan", (q) => q.eq("plan", "free"))
        .unique();
    });

    expect(storedPeriod).toMatchObject({
      plan: "free",
      resetAt,
    });
  });

  it("does not duplicate a stored reset period when the value is unchanged", async () => {
    const t = convexTest(schema, convexModules);
    const resetAt = Date.UTC(2026, 3, 1, 0, 0, 0);

    await t.mutation(async (ctx) => {
      await upsertStoredCreditResetTimestamp(ctx.db, "free", resetAt);
      await upsertStoredCreditResetTimestamp(ctx.db, "free", resetAt);
    });

    const periods = await t.query(async (ctx) => {
      return await ctx.db
        .query("creditResetPeriods")
        .withIndex("by_plan", (q) => q.eq("plan", "free"))
        .collect();
    });

    expect(periods).toHaveLength(1);
    expect(periods[0]?.resetAt).toBe(resetAt);
  });

  it("patches a stored reset period when the boundary changes", async () => {
    const t = convexTest(schema, convexModules);
    const firstResetAt = Date.UTC(2026, 3, 1, 0, 0, 0);
    const secondResetAt = Date.UTC(2026, 3, 2, 0, 0, 0);

    await t.mutation(async (ctx) => {
      await upsertStoredCreditResetTimestamp(ctx.db, "free", firstResetAt);
      await upsertStoredCreditResetTimestamp(ctx.db, "free", secondResetAt);
    });

    const storedResetAt = await t.query(async (ctx) => {
      return await getStoredCreditResetTimestamp(ctx.db, "free");
    });

    expect(storedResetAt).toBe(secondResetAt);
  });

  it("returns the stored boundary when it is already current", async () => {
    const t = convexTest(schema, convexModules);
    const now = Date.UTC(2026, 3, 2, 10, 0, 0);
    const resetAt = getCurrentCreditResetTimestamp("free", now);

    await t.mutation(async (ctx) => {
      await upsertStoredCreditResetTimestamp(ctx.db, "free", resetAt);
    });

    const resolvedResetAt = await t.mutation(async (ctx) => {
      return await resolveCurrentCreditResetTimestamp(ctx.db, "free", now);
    });

    expect(resolvedResetAt).toBe(resetAt);
  });

  it("repairs a stale stored boundary and returns the current one", async () => {
    const t = convexTest(schema, convexModules);
    const staleResetAt = Date.UTC(2026, 3, 1, 0, 0, 0);
    const now = Date.UTC(2026, 3, 2, 10, 0, 0);
    const currentResetAt = getCurrentCreditResetTimestamp("free", now);

    await t.mutation(async (ctx) => {
      await upsertStoredCreditResetTimestamp(ctx.db, "free", staleResetAt);
    });

    const resolvedResetAt = await t.mutation(async (ctx) => {
      return await resolveCurrentCreditResetTimestamp(ctx.db, "free", now);
    });

    const storedResetAt = await t.query(async (ctx) => {
      return await getStoredCreditResetTimestamp(ctx.db, "free");
    });

    expect(resolvedResetAt).toBe(currentResetAt);
    expect(storedResetAt).toBe(currentResetAt);
  });

  it("resolves effective credits from the repaired current reset period", async () => {
    const t = convexTest(schema, convexModules);
    const staleResetAt = Date.UTC(2026, 3, 1, 0, 0, 0);
    const now = Date.UTC(2026, 3, 2, 10, 0, 0);

    const effectiveState = await t.mutation(async (ctx) => {
      await upsertStoredCreditResetTimestamp(ctx.db, "free", staleResetAt);

      return await resolveEffectiveCreditState(
        ctx.db,
        {
          credits: -3,
          creditsResetAt: staleResetAt,
          plan: "free",
        },
        now
      );
    });

    expect(effectiveState).toEqual({
      credits: 7,
      creditsResetAt: Date.UTC(2026, 3, 2, 0, 0, 0),
    });
  });

  it("seeds a missing reset period before resolving effective credits", async () => {
    const t = convexTest(schema, convexModules);
    const now = Date.UTC(2026, 3, 2, 10, 0, 0);

    const effectiveState = await t.mutation(async (ctx) => {
      return await resolveEffectiveCreditState(
        ctx.db,
        {
          credits: -3,
          creditsResetAt: Date.UTC(2026, 3, 1, 0, 0, 0),
          plan: "free",
        },
        now
      );
    });

    const storedResetAt = await t.query(async (ctx) => {
      return await getStoredCreditResetTimestamp(ctx.db, "free");
    });

    expect(effectiveState).toEqual({
      credits: 7,
      creditsResetAt: Date.UTC(2026, 3, 2, 0, 0, 0),
    });
    expect(storedResetAt).toBe(Date.UTC(2026, 3, 2, 0, 0, 0));
  });

  it("returns a grant transaction when a reset window advances", () => {
    expect(
      getCreditResetGrantTransaction(
        {
          credits: -3,
          creditsResetAt: Date.UTC(2026, 3, 1, 0, 0, 0),
          plan: "free",
        },
        {
          credits: 7,
          creditsResetAt: Date.UTC(2026, 3, 2, 0, 0, 0),
        }
      )
    ).toEqual({
      amount: 10,
      type: "daily-grant",
      balanceAfter: 7,
      metadata: {
        "previous-balance": -3,
        "previous-reset-at": Date.UTC(2026, 3, 1, 0, 0, 0),
        "reset-at": Date.UTC(2026, 3, 2, 0, 0, 0),
      },
    });
  });

  it("returns null when credits are already in the current reset window", () => {
    expect(
      getCreditResetGrantTransaction(
        {
          credits: 7,
          creditsResetAt: Date.UTC(2026, 3, 2, 0, 0, 0),
          plan: "free",
        },
        {
          credits: 7,
          creditsResetAt: Date.UTC(2026, 3, 2, 0, 0, 0),
        }
      )
    ).toBeNull();
  });
});
