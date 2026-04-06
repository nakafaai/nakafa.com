import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const NOW = new Date(Date.UTC(2026, 3, 5, 12, 0, 0)).toISOString();

describe("customers/queries/internal/maintenance", () => {
  it("lists integrity pages for users, customers, and active subscriptions", async () => {
    const t = convexTest(schema, convexModules);

    const state = await t.mutation(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        authId: "auth-customer-integrity",
        credits: 10,
        creditsResetAt: 1,
        email: "integrity@example.com",
        name: "Integrity User",
        plan: "free",
      });

      await ctx.db.insert("customers", {
        id: "polar-integrity",
        externalId: "auth-customer-integrity",
        metadata: { userId },
        userId,
      });

      await ctx.db.insert("subscriptions", {
        amount: null,
        cancelAtPeriodEnd: false,
        checkoutId: null,
        createdAt: NOW,
        currency: null,
        currentPeriodEnd: null,
        currentPeriodStart: NOW,
        customerCancellationComment: null,
        customerCancellationReason: null,
        customerId: "polar-integrity",
        endedAt: null,
        id: "active-subscription",
        metadata: {},
        modifiedAt: null,
        productId: "pro-product",
        recurringInterval: null,
        startedAt: NOW,
        status: "active",
      });
      await ctx.db.insert("subscriptions", {
        amount: null,
        cancelAtPeriodEnd: false,
        checkoutId: null,
        createdAt: NOW,
        currency: null,
        currentPeriodEnd: null,
        currentPeriodStart: NOW,
        customerCancellationComment: null,
        customerCancellationReason: null,
        customerId: "polar-integrity",
        endedAt: null,
        id: "canceled-subscription",
        metadata: {},
        modifiedAt: null,
        productId: "pro-product",
        recurringInterval: null,
        startedAt: NOW,
        status: "canceled",
      });

      return userId;
    });

    const [users, customers, subscriptions] = await Promise.all([
      t.query(
        internal.customers.queries.internal.maintenance
          .listUsersForCustomerIntegrity,
        {
          paginationOpts: {
            cursor: null,
            numItems: 100,
          },
        }
      ),
      t.query(
        internal.customers.queries.internal.maintenance
          .listCustomersForIntegrity,
        {
          paginationOpts: {
            cursor: null,
            numItems: 100,
          },
        }
      ),
      t.query(
        internal.customers.queries.internal.maintenance
          .listActiveSubscriptionsForIntegrity,
        {
          paginationOpts: {
            cursor: null,
            numItems: 100,
          },
        }
      ),
    ]);

    expect(users.page).toEqual([
      expect.objectContaining({
        userId: state,
      }),
    ]);
    expect(customers.page).toEqual([
      expect.objectContaining({
        polarCustomerId: "polar-integrity",
        userId: state,
      }),
    ]);
    expect(subscriptions.page).toEqual([
      expect.objectContaining({
        customerId: "polar-integrity",
        subscriptionId: "active-subscription",
      }),
    ]);
  });
});
