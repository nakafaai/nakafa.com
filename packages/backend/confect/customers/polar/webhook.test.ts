import { actionLayer } from "@confect/server/RegisteredFunction";
import { beforeEach, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { products } from "@repo/backend/confect/customers/polar/products";
import {
  processPolarWebhookEvent,
  upsertPolarCustomerWebhook,
  upsertPolarSubscriptionWebhook,
} from "@repo/backend/confect/customers/polar/webhook";
import type { SubscriptionRecord } from "@repo/backend/confect/subscriptions/records/spec";
import {
  buildSubscription,
  buildWebhookCustomer,
  buildWebhookEvent,
  createWebhookTestConvex,
  insertCustomerTombstone,
  polarCustomer,
  polarProduct,
  polarSubscription,
  readPurchaseCompletionState,
  readWebhookState,
  seedWebhookUser,
} from "@repo/backend/test/polar";
import { Effect } from "effect";

const polarGateway = vi.hoisted(() => ({
  getCustomerById: vi.fn(),
}));
vi.mock("@repo/backend/confect/customers/polar/live", () => ({
  polarGateway,
}));
const NOW = Date.UTC(2026, 6, 29, 0, 0, 0);
beforeEach(() => {
  polarGateway.getCustomerById.mockReset();
});
it.effect("grants the complete Pro entitlement from one Polar webhook", () =>
  Effect.gen(function* () {
    const runtimeServices = yield* Effect.context<never>();
    const t = createWebhookTestConvex();
    const userId = yield* seedWebhookUser(t, "purchase");
    const subscription = {
      ...buildSubscription("polar-purchase", "purchase"),
      productId: products.pro.id,
      status: "active",
    } satisfies SubscriptionRecord;
    polarGateway.getCustomerById.mockReturnValue(
      Effect.succeed(
        buildWebhookCustomer("purchase", {
          metadata: {
            userId,
          },
        })
      )
    );
    const disposition = yield* Effect.promise(() =>
      t.action((ctx) =>
        Effect.runPromiseWith(runtimeServices)(
          upsertPolarSubscriptionWebhook(subscription, "create").pipe(
            Effect.provide(actionLayer(confectSchema, ctx))
          )
        )
      )
    );
    const state = yield* Effect.promise(() =>
      t.query((ctx) =>
        Effect.runPromiseWith(runtimeServices)(
          readPurchaseCompletionState(
            ctx,
            userId,
            subscription.customerId,
            subscription.id
          )
        )
      )
    );
    expect(disposition).toBe("stored");
    expect(state.customer).toMatchObject({
      id: subscription.customerId,
      userId,
    });
    expect(state.subscription).toMatchObject({
      customerId: subscription.customerId,
      id: subscription.id,
      productId: products.pro.id,
      status: "active",
    });
    expect(state.user).toMatchObject({
      credits: 3000,
      plan: "pro",
    });
    expect(state.creditTransactions).toEqual([
      expect.objectContaining({
        amount: 3000,
        balanceAfter: 3000,
        metadata: {
          "new-plan": "pro",
          "previous-plan": "free",
          reason: "plan-upgrade",
          "subscription-id": subscription.id,
        },
        type: "purchase",
        userId,
      }),
    ]);
  })
);
it.effect(
  "resolves the current Polar customer before storing a subscription",
  () =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
      const t = createWebhookTestConvex();
      const userId = yield* seedWebhookUser(t, "active");
      const subscription = buildSubscription("polar-active", "active");
      polarGateway.getCustomerById.mockReturnValue(
        Effect.succeed(
          buildWebhookCustomer("active", {
            metadata: {
              userId,
            },
          })
        )
      );
      const disposition = yield* Effect.promise(() =>
        t.action((ctx) =>
          Effect.runPromiseWith(runtimeServices)(
            upsertPolarSubscriptionWebhook(subscription, "update").pipe(
              Effect.provide(actionLayer(confectSchema, ctx))
            )
          )
        )
      );
      const state = yield* Effect.promise(() =>
        t.query((ctx) =>
          Effect.runPromiseWith(runtimeServices)(readWebhookState(ctx))
        )
      );
      expect(polarGateway.getCustomerById).toHaveBeenCalledWith("polar-active");
      expect(disposition).toBe("stored");
      expect(state.customers).toMatchObject([
        {
          id: "polar-active",
          userId,
        },
      ]);
      expect(state.subscriptions).toMatchObject([
        {
          customerId: "polar-active",
          id: "subscription-active",
        },
      ]);
    })
);
it.effect(
  "keeps subscription delivery retryable during cancelable preparation",
  () =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
      const t = createWebhookTestConvex();
      const userId = yield* seedWebhookUser(t, "pending", NOW);
      const subscription = buildSubscription("polar-pending", "pending");
      polarGateway.getCustomerById.mockReturnValue(
        Effect.succeed(
          buildWebhookCustomer("pending", {
            metadata: {
              userId,
            },
          })
        )
      );
      const disposition = yield* Effect.promise(() =>
        t.action((ctx) =>
          Effect.runPromiseWith(runtimeServices)(
            upsertPolarSubscriptionWebhook(subscription, "create").pipe(
              Effect.provide(actionLayer(confectSchema, ctx))
            )
          )
        )
      );
      const state = yield* Effect.promise(() =>
        t.query((ctx) =>
          Effect.runPromiseWith(runtimeServices)(readWebhookState(ctx))
        )
      );
      expect(disposition).toBe("missing");
      expect(state).toEqual({
        customers: [],
        subscriptions: [],
      });
    })
);
it.effect(
  "discards subscription delivery for a durable customer tombstone",
  () =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
      const t = createWebhookTestConvex();
      const subscription = buildSubscription("polar-deleted", "deleted");
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          Effect.runPromiseWith(runtimeServices)(
            insertCustomerTombstone(ctx, subscription.customerId)
          )
        )
      );
      polarGateway.getCustomerById.mockReturnValue(
        Effect.succeed(
          buildWebhookCustomer("deleted", {
            id: subscription.customerId,
            metadata: {},
          })
        )
      );
      const disposition = yield* Effect.promise(() =>
        t.action((ctx) =>
          Effect.runPromiseWith(runtimeServices)(
            upsertPolarSubscriptionWebhook(subscription, "create").pipe(
              Effect.provide(actionLayer(confectSchema, ctx))
            )
          )
        )
      );
      const state = yield* Effect.promise(() =>
        t.query((ctx) =>
          Effect.runPromiseWith(runtimeServices)(readWebhookState(ctx))
        )
      );
      expect(disposition).toBe("discarded");
      expect(state).toEqual({
        customers: [],
        subscriptions: [],
      });
    })
);
it.effect(
  "discards subscription delivery after Polar removes its customer",
  () =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
      const t = createWebhookTestConvex();
      const subscription = buildSubscription("polar-missing", "missing");
      polarGateway.getCustomerById.mockReturnValue(Effect.succeed(null));
      const disposition = yield* Effect.promise(() =>
        t.action((ctx) =>
          Effect.runPromiseWith(runtimeServices)(
            upsertPolarSubscriptionWebhook(subscription, "create").pipe(
              Effect.provide(actionLayer(confectSchema, ctx))
            )
          )
        )
      );
      const subscriptions = yield* Effect.promise(() =>
        t.query((ctx) => ctx.db.query("subscriptions").collect())
      );
      expect(disposition).toBe("discarded");
      expect(subscriptions).toEqual([]);
    })
);
it.effect(
  "keeps an unknown customer retryable but accepts a tombstoned discard",
  () =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
      const t = createWebhookTestConvex();
      const missing = buildWebhookCustomer("unknown");
      const missingDisposition = yield* Effect.promise(() =>
        t.action((ctx) =>
          Effect.runPromiseWith(runtimeServices)(
            upsertPolarCustomerWebhook(missing).pipe(
              Effect.provide(actionLayer(confectSchema, ctx))
            )
          )
        )
      );
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          Effect.runPromiseWith(runtimeServices)(
            insertCustomerTombstone(ctx, missing.id)
          )
        )
      );
      const discardedDisposition = yield* Effect.promise(() =>
        t.action((ctx) =>
          Effect.runPromiseWith(runtimeServices)(
            upsertPolarCustomerWebhook(missing).pipe(
              Effect.provide(actionLayer(confectSchema, ctx))
            )
          )
        )
      );
      expect(missingDisposition).toBe("missing");
      expect(discardedDisposition).toBe("discarded");
    })
);
it.effect("keeps a subscription retryable until its app user exists", () =>
  Effect.gen(function* () {
    const runtimeServices = yield* Effect.context<never>();
    const t = createWebhookTestConvex();
    const subscription = buildSubscription("polar-unknown", "unknown");
    polarGateway.getCustomerById.mockReturnValue(
      Effect.succeed(buildWebhookCustomer("unknown"))
    );
    const disposition = yield* Effect.promise(() =>
      t.action((ctx) =>
        Effect.runPromiseWith(runtimeServices)(
          upsertPolarSubscriptionWebhook(subscription, "create").pipe(
            Effect.provide(actionLayer(confectSchema, ctx))
          )
        )
      )
    );
    const subscriptions = yield* Effect.promise(() =>
      t.query((ctx) => ctx.db.query("subscriptions").collect())
    );
    expect(disposition).toBe("missing");
    expect(subscriptions).toEqual([]);
  })
);
it.effect(
  "fails closed when Polar metadata and external identity disagree",
  () =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
      const t = createWebhookTestConvex();
      const metadataUserId = yield* seedWebhookUser(t, "metadata-owner");
      yield* seedWebhookUser(t, "external-owner");
      const disposition = yield* Effect.promise(() =>
        t.action((ctx) =>
          Effect.runPromiseWith(runtimeServices)(
            upsertPolarCustomerWebhook({
              email: "conflict@example.com",
              externalId: "auth-external-owner",
              id: "polar-conflict",
              metadata: {
                userId: metadataUserId,
              },
              name: "Conflicting User",
            }).pipe(Effect.provide(actionLayer(confectSchema, ctx)))
          )
        )
      );
      const customers = yield* Effect.promise(() =>
        t.query((ctx) => ctx.db.query("customers").collect())
      );
      expect(disposition).toBe("missing");
      expect(customers).toEqual([]);
    })
);
it.effect.each([
  "customer.created",
  "customer.updated",
  "customer.deleted",
] as const)("dispatches verified %s with lifecycle fencing", (type) =>
  Effect.gen(function* () {
    const runtimeServices = yield* Effect.context<never>();
    const t = createWebhookTestConvex();
    const userId = yield* seedWebhookUser(t, "dispatch");
    const data = {
      ...polarCustomer,
      email: "dispatch@example.com",
      external_id: null,
      metadata: {
        userId,
      },
    };
    expect(
      yield* Effect.promise(() =>
        t.action((ctx) =>
          Effect.runPromiseWith(runtimeServices)(
            processPolarWebhookEvent(buildWebhookEvent(type, data)).pipe(
              Effect.provide(actionLayer(confectSchema, ctx))
            )
          )
        )
      )
    ).toBe(true);
    const state = yield* Effect.promise(() =>
      t.query((ctx) =>
        Effect.runPromiseWith(runtimeServices)(readWebhookState(ctx))
      )
    );
    expect(state.customers).toHaveLength(type === "customer.deleted" ? 0 : 1);
  })
);
it.effect.each([
  "subscription.created",
  "subscription.updated",
  "subscription.active",
  "subscription.canceled",
  "subscription.past_due",
  "subscription.uncanceled",
  "subscription.revoked",
] as const)("dispatches verified %s through current Polar identity", (type) =>
  Effect.gen(function* () {
    const runtimeServices = yield* Effect.context<never>();
    const t = createWebhookTestConvex();
    const userId = yield* seedWebhookUser(t, "dispatch");
    polarGateway.getCustomerById.mockReturnValue(
      Effect.succeed(
        buildWebhookCustomer("dispatch", {
          id: polarSubscription.customer_id,
          metadata: {
            userId,
          },
        })
      )
    );
    expect(
      yield* Effect.promise(() =>
        t.action((ctx) =>
          Effect.runPromiseWith(runtimeServices)(
            processPolarWebhookEvent(
              buildWebhookEvent(type, polarSubscription)
            ).pipe(Effect.provide(actionLayer(confectSchema, ctx)))
          )
        )
      )
    ).toBe(true);
    const state = yield* Effect.promise(() =>
      t.query((ctx) =>
        Effect.runPromiseWith(runtimeServices)(readWebhookState(ctx))
      )
    );
    expect(state.subscriptions).toMatchObject([
      {
        id: polarSubscription.id,
        currentPeriodEnd: polarSubscription.current_period_end,
      },
    ]);
  })
);
it("acknowledges unrelated verified product events without billing writes", async () => {
  const t = createWebhookTestConvex();
  expect(
    await t.action((ctx) =>
      Effect.runPromise(
        processPolarWebhookEvent(
          buildWebhookEvent("product.updated", polarProduct)
        ).pipe(Effect.provide(actionLayer(confectSchema, ctx)))
      )
    )
  ).toBe(true);
  expect(
    await t.query((ctx) => Effect.runPromise(readWebhookState(ctx)))
  ).toEqual({
    customers: [],
    subscriptions: [],
  });
});
it.effect.each(["prepared", "deleted", "unavailable"] as const)(
  "honors customer lookup and write outcomes: %s",
  (kind) =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
      const t = createWebhookTestConvex();
      const userId = yield* seedWebhookUser(t, "race");
      const result = yield* Effect.promise(() =>
        t.action((ctx) => {
          if (kind === "unavailable") {
            vi.spyOn(ctx, "runQuery").mockRejectedValueOnce(
              new Error("database unavailable")
            );
          } else {
            vi.spyOn(ctx, "runMutation").mockResolvedValueOnce({
              kind,
            });
          }
          const program = upsertPolarCustomerWebhook(
            buildWebhookCustomer("race", { id: "race", metadata: { userId } })
          );
          return Effect.runPromiseWith(runtimeServices)(
            program.pipe(
              Effect.match({
                onFailure: (error) => ({
                  code: error.code,
                  message: error.message,
                }),
                onSuccess: (disposition) => disposition,
              }),
              Effect.provide(actionLayer(confectSchema, ctx))
            )
          );
        })
      );
      expect(result).toEqual(
        {
          unavailable: {
            code: "POLAR_WEBHOOK_IO_FAILED",
            message: "database unavailable",
          },
          prepared: "missing",
          deleted: "discarded",
        }[kind]
      );
    })
);
