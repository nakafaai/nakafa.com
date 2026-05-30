import { internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

/** Inserts a user row for customer reconciliation tests. */
function insertCustomerUser(ctx: MutationCtx, suffix: string) {
  return ctx.db.insert("users", {
    authId: `auth-${suffix}`,
    credits: 10,
    creditsResetAt: 1,
    email: `${suffix}@example.com`,
    name: suffix,
    plan: "free",
  });
}

/** Inserts a local customer row owned by one user. */
function insertCustomerRow(
  ctx: MutationCtx,
  {
    polarId,
    userId,
  }: {
    polarId: string;
    userId: Id<"users">;
  }
) {
  return ctx.db.insert("customers", {
    id: polarId,
    externalId: null,
    metadata: {},
    userId,
  });
}

describe("customers/mutations", () => {
  it("inserts a new customer when no local row exists", async () => {
    const t = convexTest(schema, convexModules);
    const userId = await t.mutation((ctx) => insertCustomerUser(ctx, "new"));

    const customerId = await t.mutation(
      internal.customers.mutations.internal.upsertCustomer,
      {
        customer: {
          id: "polar-new",
          externalId: "auth-new",
          metadata: { userId },
          userId,
        },
      }
    );

    const customer = await t.query(async (ctx) => await ctx.db.get(customerId));

    expect(customer).toMatchObject({
      externalId: "auth-new",
      id: "polar-new",
      metadata: { userId },
      userId,
    });
  });

  it("patches the same row when user and Polar id both match", async () => {
    const t = convexTest(schema, convexModules);

    const state = await t.mutation(async (ctx) => {
      const userId = await insertCustomerUser(ctx, "same");
      const customerId = await insertCustomerRow(ctx, {
        polarId: "polar-same",
        userId,
      });

      return { customerId, userId };
    });

    const resultId = await t.mutation(
      internal.customers.mutations.internal.upsertCustomer,
      {
        customer: {
          id: "polar-same",
          externalId: "auth-same",
          metadata: { tier: "pro" },
          userId: state.userId,
        },
      }
    );

    const customer = await t.query(async (ctx) => await ctx.db.get(resultId));

    expect(resultId).toBe(state.customerId);
    expect(customer).toMatchObject({
      externalId: "auth-same",
      id: "polar-same",
      metadata: { tier: "pro" },
      userId: state.userId,
    });
  });

  it("patches an existing Polar row when only the Polar id matches", async () => {
    const t = convexTest(schema, convexModules);

    const state = await t.mutation(async (ctx) => {
      const oldUserId = await insertCustomerUser(ctx, "old-polar");
      const newUserId = await insertCustomerUser(ctx, "new-polar");
      const customerId = await insertCustomerRow(ctx, {
        polarId: "polar-only",
        userId: oldUserId,
      });

      return { customerId, newUserId };
    });

    const resultId = await t.mutation(
      internal.customers.mutations.internal.upsertCustomer,
      {
        customer: {
          id: "polar-only",
          externalId: "auth-new-polar",
          metadata: { userId: state.newUserId },
          userId: state.newUserId,
        },
      }
    );

    const customer = await t.query(async (ctx) => await ctx.db.get(resultId));

    expect(resultId).toBe(state.customerId);
    expect(customer).toMatchObject({
      externalId: "auth-new-polar",
      id: "polar-only",
      userId: state.newUserId,
    });
  });

  it("patches an existing user row when only the user matches", async () => {
    const t = convexTest(schema, convexModules);

    const state = await t.mutation(async (ctx) => {
      const userId = await insertCustomerUser(ctx, "user-only");
      const customerId = await insertCustomerRow(ctx, {
        polarId: "polar-stale",
        userId,
      });

      return { customerId, userId };
    });

    const resultId = await t.mutation(
      internal.customers.mutations.internal.upsertCustomer,
      {
        customer: {
          id: "polar-fresh",
          externalId: "auth-user-only",
          metadata: { userId: state.userId },
          userId: state.userId,
        },
      }
    );

    const customer = await t.query(async (ctx) => await ctx.db.get(resultId));

    expect(resultId).toBe(state.customerId);
    expect(customer).toMatchObject({
      externalId: "auth-user-only",
      id: "polar-fresh",
      userId: state.userId,
    });
  });

  it("reconciles local rows by Polar customer id and removes stale duplicates", async () => {
    const t = convexTest(schema, convexModules);

    const state = await t.mutation(async (ctx) => {
      const staleUserId = await insertCustomerUser(ctx, "stale");
      const currentUserId = await insertCustomerUser(ctx, "current");
      const stalePolarRowId = await insertCustomerRow(ctx, {
        polarId: "polar-target",
        userId: staleUserId,
      });
      const staleUserRowId = await insertCustomerRow(ctx, {
        polarId: "polar-stale-user",
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

  it("deletes an existing customer by Polar id", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      const userId = await insertCustomerUser(ctx, "delete");
      await insertCustomerRow(ctx, {
        polarId: "polar-delete",
        userId,
      });
    });

    await expect(
      t.mutation(internal.customers.mutations.internal.deleteCustomerById, {
        id: "polar-delete",
      })
    ).resolves.toBeNull();

    const customers = await t.query(
      async (ctx) => await ctx.db.query("customers").collect()
    );

    expect(customers).toEqual([]);
  });

  it("ignores delete requests for unknown Polar ids", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.mutation(internal.customers.mutations.internal.deleteCustomerById, {
        id: "missing-polar",
      })
    ).resolves.toBeNull();
  });
});
