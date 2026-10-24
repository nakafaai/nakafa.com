import { describe, expect, it } from "@effect/vitest";
import { copyPolarSubscriptionsPage } from "@repo/backend/confect/billing/migration";
import {
  createBillingTestConvex,
  polarSubscriptionRow,
  runInMutation,
} from "@repo/backend/test/billing";
import { MASCOT_CODE } from "@repo/backend/test/mascot";

/** Inserts one person, their Polar customer, and the stored subscriptions that customer holds. */
async function seedPolar(
  ctx: Parameters<
    Parameters<ReturnType<typeof createBillingTestConvex>["run"]>[0]
  >[0],
  subscriptions: ReturnType<typeof polarSubscriptionRow>[]
) {
  const userId = await ctx.db.insert("users", {
    authId: "auth-migration",
    credits: 0,
    creditsResetAt: 0,
    email: "migration@example.com",
    mascot: MASCOT_CODE,
    name: "Migration",
    plan: "free",
  });
  await ctx.db.insert("customers", {
    externalId: null,
    id: "cust_polar_1",
    metadata: {},
    userId,
  });
  for (const subscription of subscriptions) {
    await ctx.db.insert("subscriptions", subscription);
  }
  return userId;
}

describe("billing/migration", () => {
  it("copies a Polar subscription with its account and its grant", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const userId = await seedPolar(ctx, [polarSubscriptionRow()]);
      const page = await runInMutation(
        ctx,
        copyPolarSubscriptionsPage({ cursor: null, numItems: 10 })
      );
      const accounts = await ctx.db.query("billingAccounts").collect();
      const subscriptions = await ctx.db
        .query("billingSubscriptions")
        .collect();
      const grants = await ctx.db.query("billingGrants").collect();
      return {
        accountCustomer: accounts[0]?.providerCustomerId,
        accountOwner: accounts[0]?.owner,
        grantProduct: grants[0]?.product,
        grantUser: grants[0]?.product === "pro" ? grants[0].userId : null,
        page,
        status: subscriptions[0]?.status,
        subscriptionOffer: subscriptions[0]?.offer,
        userId,
      };
    });
    expect(result).toMatchObject({
      accountCustomer: "cust_polar_1",
      accountOwner: { kind: "personal", userId: result.userId },
      grantProduct: "pro",
      grantUser: result.userId,
      page: { copied: 1, isDone: true, skipped: 0 },
      status: "active",
      subscriptionOffer: "pro.monthly",
    });
  });

  it("skips a subscription without a customer or outside the catalog", async () => {
    const t = createBillingTestConvex();
    const page = await t.run(async (ctx) => {
      await seedPolar(ctx, [
        polarSubscriptionRow({ customerId: "cust_missing", id: "sub_orphan" }),
        polarSubscriptionRow({ id: "sub_other_product", productId: "other" }),
      ]);
      return runInMutation(
        ctx,
        copyPolarSubscriptionsPage({ cursor: null, numItems: 10 })
      );
    });
    expect(page).toMatchObject({ copied: 0, isDone: true, skipped: 2 });
  });

  it("copies nothing new when the same page runs again", async () => {
    const t = createBillingTestConvex();
    await t.run(async (ctx) => {
      await seedPolar(ctx, [polarSubscriptionRow()]);
    });
    for (let run = 0; run < 2; run += 1) {
      await t.run(async (ctx) =>
        runInMutation(
          ctx,
          copyPolarSubscriptionsPage({ cursor: null, numItems: 10 })
        )
      );
    }
    const counts = await t.run(async (ctx) => ({
      accounts: (await ctx.db.query("billingAccounts").collect()).length,
      grants: (await ctx.db.query("billingGrants").collect()).length,
      subscriptions: (await ctx.db.query("billingSubscriptions").collect())
        .length,
    }));
    expect(counts).toEqual({ accounts: 1, grants: 1, subscriptions: 1 });
  });

  it("leaves a newer subscription state in the billing tables untouched", async () => {
    const t = createBillingTestConvex();
    await t.run(async (ctx) => {
      await seedPolar(ctx, [polarSubscriptionRow()]);
    });
    await t.run(async (ctx) =>
      runInMutation(
        ctx,
        copyPolarSubscriptionsPage({ cursor: null, numItems: 10 })
      )
    );
    const page = await t.run(async (ctx) => {
      const [stored] = await ctx.db.query("billingSubscriptions").collect();
      if (stored === undefined) {
        throw new Error("The copy should have written the subscription");
      }
      await ctx.db.patch(stored._id, {
        providerUpdatedAt: Date.UTC(2027, 0, 1),
      });
      return runInMutation(
        ctx,
        copyPolarSubscriptionsPage({ cursor: null, numItems: 10 })
      );
    });
    expect(page).toMatchObject({ copied: 0, skipped: 1 });
  });

  it("marks an account copied from a dollar subscription with an unknown country", async () => {
    const t = createBillingTestConvex();
    await t.run(async (ctx) => {
      await seedPolar(ctx, [
        polarSubscriptionRow({ currency: "usd", id: "sub_usd" }),
      ]);
    });
    await t.run(async (ctx) =>
      runInMutation(
        ctx,
        copyPolarSubscriptionsPage({ cursor: null, numItems: 10 })
      )
    );
    const account = await t.run(async (ctx) => {
      const [stored] = await ctx.db.query("billingAccounts").collect();
      return stored === undefined
        ? null
        : { country: stored.country, currency: stored.currency };
    });
    expect(account).toEqual({ country: "ZZ", currency: "USD" });
  });

  it("returns a cursor until the last page", async () => {
    const t = createBillingTestConvex();
    await t.run(async (ctx) => {
      await seedPolar(ctx, [
        polarSubscriptionRow({ id: "sub_a" }),
        polarSubscriptionRow({ id: "sub_b" }),
      ]);
    });
    // Convex allows one paginated query per function execution, so each page is its own run.
    const first = await t.run(async (ctx) =>
      runInMutation(
        ctx,
        copyPolarSubscriptionsPage({ cursor: null, numItems: 1 })
      )
    );
    const second = await t.run(async (ctx) =>
      runInMutation(
        ctx,
        copyPolarSubscriptionsPage({
          cursor: first.continueCursor,
          numItems: 1,
        })
      )
    );
    expect(first.isDone).toBe(false);
    expect(second.isDone).toBe(true);
    expect(first.copied + second.copied).toBe(2);
  });
});
