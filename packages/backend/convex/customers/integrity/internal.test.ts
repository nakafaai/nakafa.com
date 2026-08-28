import { describe, expect, it } from "@effect/vitest";
import { internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { Effect } from "effect";

const NOW = new Date(Date.UTC(2026, 3, 5, 12, 0, 0)).toISOString();

const seedCustomerIntegrityState = Effect.fn(
  "customers.integrity.test.seedState"
)(function* (ctx: MutationCtx) {
  const userId = yield* Effect.promise(() =>
    ctx.db.insert("users", {
      authId: "auth-customer-integrity",
      credits: 10,
      creditsResetAt: 1,
      email: "integrity@example.com",
      name: "Integrity User",
      plan: "free",
    })
  );

  yield* Effect.promise(() =>
    ctx.db.insert("customers", {
      id: "polar-integrity",
      externalId: "auth-customer-integrity",
      metadata: { userId },
      userId,
    })
  );

  yield* Effect.promise(() =>
    ctx.db.insert("subscriptions", {
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
    })
  );

  yield* Effect.promise(() =>
    ctx.db.insert("subscriptions", {
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
    })
  );

  return userId;
});

describe("customers/integrity/internal", () => {
  it.effect(
    "lists integrity pages for users, customers, and active subscriptions",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        const userId = yield* Effect.promise(() =>
          t.mutation((ctx) => runConvexProgram(seedCustomerIntegrityState(ctx)))
        );

        const { customers, subscriptions, users } = yield* Effect.all(
          {
            customers: Effect.promise(() =>
              t.query(
                internal.customers.integrity.internal.listCustomersForIntegrity,
                {
                  paginationOpts: {
                    cursor: null,
                    numItems: 100,
                  },
                }
              )
            ),
            subscriptions: Effect.promise(() =>
              t.query(
                internal.customers.integrity.internal
                  .listActiveSubscriptionsForIntegrity,
                {
                  paginationOpts: {
                    cursor: null,
                    numItems: 100,
                  },
                }
              )
            ),
            users: Effect.promise(() =>
              t.query(
                internal.customers.integrity.internal
                  .listUsersForCustomerIntegrity,
                {
                  paginationOpts: {
                    cursor: null,
                    numItems: 100,
                  },
                }
              )
            ),
          },
          { concurrency: "unbounded" }
        );

        expect(users.page).toEqual([
          expect.objectContaining({
            userId,
          }),
        ]);
        expect(customers.page).toEqual([
          expect.objectContaining({
            polarCustomerId: "polar-integrity",
            userId,
          }),
        ]);
        expect(subscriptions.page).toEqual([
          expect.objectContaining({
            customerId: "polar-integrity",
            subscriptionId: "active-subscription",
          }),
        ]);
      })
  );
});
