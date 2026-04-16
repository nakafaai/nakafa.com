import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("customers/mutations", () => {
  it("reconciles local rows by Polar customer id and removes stale duplicates", async () => {
    const t = convexTest(schema, convexModules);

    const state = await t.mutation(async (ctx) => {
      const staleUserId = await ctx.db.insert("users", {
        authId: "auth-stale",
        credits: 10,
        creditsResetAt: 1,
        email: "stale@example.com",
        name: "Stale",
        plan: "free",
      });
      const currentUserId = await ctx.db.insert("users", {
        authId: "auth-current",
        credits: 10,
        creditsResetAt: 1,
        email: "current@example.com",
        name: "Current",
        plan: "free",
      });
      const stalePolarRowId = await ctx.db.insert("customers", {
        id: "polar-target",
        externalId: null,
        metadata: {},
        userId: staleUserId,
      });
      const staleUserRowId = await ctx.db.insert("customers", {
        id: "polar-stale-user",
        externalId: null,
        metadata: {},
        userId: currentUserId,
      });

      return {
        currentUserId,
        stalePolarRowId,
        staleUserRowId,
      };
    });

    const repairedId = await t.mutation(
      internal.customers.mutations.internal.upsertCustomer,
      {
        customer: {
          id: "polar-target",
          externalId: "auth-current",
          metadata: { userId: state.currentUserId },
          userId: state.currentUserId,
        },
      }
    );

    const customers = await t.query(
      async (ctx) => await ctx.db.query("customers").collect()
    );

    expect(customers).toHaveLength(1);
    expect(customers[0]).toMatchObject({
      _id: repairedId,
      externalId: "auth-current",
      id: "polar-target",
      userId: state.currentUserId,
    });
  });
});
