import { describe, expect, it } from "@effect/vitest";
import { api } from "@repo/backend/convex/_generated/api";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { products } from "@repo/backend/convex/utils/polar/products";
import { TRYOUT_TEST_NOW } from "@repo/backend/test/tryouts";
import type { FunctionArgs } from "convex/server";

const startAccessArgs: FunctionArgs<
  typeof api.tryouts.queries.access.getStartAccess
> = {
  countryKey: "indonesia",
  examKey: "snbt",
  locale: "id",
  now: TRYOUT_TEST_NOW,
  setKey: "set-1",
  trackKey: "2027",
};

describe("tryouts/queries/access", () => {
  it("shows free access to anonymous and free accounts", async () => {
    const t = createConvexTestWithBetterAuth();

    expect(
      await t.query(api.tryouts.queries.access.getStartAccess, startAccessArgs)
    ).toEqual({ kind: "free-attempt" });

    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, {
        now: TRYOUT_TEST_NOW,
        suffix: "start-access-free",
      })
    );
    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });

    expect(
      await authed.query(
        api.tryouts.queries.access.getStartAccess,
        startAccessArgs
      )
    ).toEqual({ kind: "free-attempt" });
  });

  it("shows included subscription access without restricting free starts", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const seeded = await seedAuthenticatedUser(ctx, {
        now: TRYOUT_TEST_NOW,
        suffix: "start-access-included",
      });
      await ctx.db.insert("customers", {
        externalId: seeded.authUserId,
        id: "advisory-customer",
        metadata: {},
        userId: seeded.userId,
      });
      const timestamp = new Date(TRYOUT_TEST_NOW).toISOString();
      await ctx.db.insert("subscriptions", {
        amount: null,
        cancelAtPeriodEnd: false,
        checkoutId: null,
        createdAt: timestamp,
        currency: null,
        currentPeriodEnd: null,
        currentPeriodStart: timestamp,
        customerId: "advisory-customer",
        endedAt: null,
        id: "advisory-subscription",
        metadata: {},
        modifiedAt: null,
        productId: products.pro.id,
        recurringInterval: null,
        startedAt: timestamp,
        status: "active",
      });
      return seeded;
    });
    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });

    expect(
      await authed.query(
        api.tryouts.queries.access.getStartAccess,
        startAccessArgs
      )
    ).toEqual({ kind: "included" });
  });
});
