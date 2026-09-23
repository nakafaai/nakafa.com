import { beforeEach, expect, it } from "@effect/vitest";
import {
  processPolarWebhookEvent,
  upsertPolarCustomerWebhook,
  upsertPolarSubscriptionWebhook,
} from "@repo/backend/convex/customers/polar/webhook";
import {
  runConvexActionProgram,
  runConvexProgram,
} from "@repo/backend/convex/lib/effect";
import type { SubscriptionRecord } from "@repo/backend/convex/subscriptions/records/spec";
import { products } from "@repo/backend/convex/utils/polar/products";
import {
  buildSubscription,
  createWebhookTestConvex,
  insertCustomerTombstone,
  insertUser,
  polarSubscription,
  readPurchaseCompletionState,
  readWebhookState,
} from "@repo/backend/test/polar";
import { Effect } from "effect";

const polarGateway = vi.hoisted(() => ({
  getCustomerById: vi.fn(),
}));

vi.mock("@repo/backend/convex/customers/polar/live", () => ({
  polarGateway,
}));

const NOW = Date.UTC(2026, 6, 29, 0, 0, 0);

beforeEach(() => {
  polarGateway.getCustomerById.mockReset();
});

it("grants the complete Pro entitlement from one Polar webhook", async () => {
  const t = createWebhookTestConvex();
  const userId = await t.mutation((ctx) =>
    runConvexProgram(insertUser(ctx, "purchase"))
  );
  const subscription = {
    ...buildSubscription("polar-purchase", "purchase"),
    productId: products.pro.id,
    status: "active",
  } satisfies SubscriptionRecord;
  polarGateway.getCustomerById.mockReturnValue(
    Effect.succeed({
      email: "purchase@example.com",
      externalId: "auth-purchase",
      id: subscription.customerId,
      metadata: { userId },
      name: "User purchase",
    })
  );

  const disposition = await t.action((ctx) =>
    runConvexActionProgram(
      upsertPolarSubscriptionWebhook(ctx, subscription, "create")
    )
  );
  const state = await t.query((ctx) =>
    runConvexProgram(
      readPurchaseCompletionState(
        ctx,
        userId,
        subscription.customerId,
        subscription.id
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
});

it.effect(
  "resolves the current Polar customer before storing a subscription",
  () =>
    Effect.gen(function* () {
      const t = createWebhookTestConvex();
      const userId = yield* Effect.promise(() =>
        t.mutation((ctx) => runConvexProgram(insertUser(ctx, "active")))
      );
      const subscription = buildSubscription("polar-active", "active");
      polarGateway.getCustomerById.mockReturnValue(
        Effect.succeed({
          email: "active@example.com",
          externalId: "auth-active",
          id: subscription.customerId,
          metadata: { userId },
          name: "Active User",
        })
      );

      const disposition = yield* Effect.promise(() =>
        t.action((ctx) =>
          runConvexActionProgram(
            upsertPolarSubscriptionWebhook(ctx, subscription, "update")
          )
        )
      );
      const state = yield* Effect.promise(() =>
        t.query((ctx) => runConvexProgram(readWebhookState(ctx)))
      );

      expect(polarGateway.getCustomerById).toHaveBeenCalledWith("polar-active");
      expect(disposition).toBe("stored");
      expect(state.customers).toMatchObject([{ id: "polar-active", userId }]);
      expect(state.subscriptions).toMatchObject([
        { customerId: "polar-active", id: "subscription-active" },
      ]);
    })
);

it.effect(
  "keeps subscription delivery retryable during cancelable preparation",
  () =>
    Effect.gen(function* () {
      const t = createWebhookTestConvex();
      const userId = yield* Effect.promise(() =>
        t.mutation((ctx) => runConvexProgram(insertUser(ctx, "pending", NOW)))
      );
      const subscription = buildSubscription("polar-pending", "pending");
      polarGateway.getCustomerById.mockReturnValue(
        Effect.succeed({
          email: "pending@example.com",
          externalId: "auth-pending",
          id: subscription.customerId,
          metadata: { userId },
          name: "Pending User",
        })
      );

      const disposition = yield* Effect.promise(() =>
        t.action((ctx) =>
          runConvexActionProgram(
            upsertPolarSubscriptionWebhook(ctx, subscription, "create")
          )
        )
      );
      const state = yield* Effect.promise(() =>
        t.query((ctx) => runConvexProgram(readWebhookState(ctx)))
      );

      expect(disposition).toBe("missing");
      expect(state).toEqual({ customers: [], subscriptions: [] });
    })
);

it.effect(
  "discards subscription delivery for a durable customer tombstone",
  () =>
    Effect.gen(function* () {
      const t = createWebhookTestConvex();
      const subscription = buildSubscription("polar-deleted", "deleted");
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          runConvexProgram(
            insertCustomerTombstone(ctx, subscription.customerId)
          )
        )
      );
      polarGateway.getCustomerById.mockReturnValue(
        Effect.succeed({
          email: "deleted@example.com",
          externalId: "auth-deleted",
          id: subscription.customerId,
          metadata: {},
          name: "Deleted User",
        })
      );

      const disposition = yield* Effect.promise(() =>
        t.action((ctx) =>
          runConvexActionProgram(
            upsertPolarSubscriptionWebhook(ctx, subscription, "create")
          )
        )
      );
      const state = yield* Effect.promise(() =>
        t.query((ctx) => runConvexProgram(readWebhookState(ctx)))
      );

      expect(disposition).toBe("discarded");
      expect(state).toEqual({ customers: [], subscriptions: [] });
    })
);

it.effect(
  "discards subscription delivery after Polar removes its customer",
  () =>
    Effect.gen(function* () {
      const t = createWebhookTestConvex();
      const subscription = buildSubscription("polar-missing", "missing");
      polarGateway.getCustomerById.mockReturnValue(Effect.succeed(null));

      const disposition = yield* Effect.promise(() =>
        t.action((ctx) =>
          runConvexActionProgram(
            upsertPolarSubscriptionWebhook(ctx, subscription, "create")
          )
        )
      );
      const subscriptions = yield* Effect.promise(() =>
        t.query((ctx) =>
          runConvexProgram(
            Effect.promise(() => ctx.db.query("subscriptions").collect())
          )
        )
      );

      expect(disposition).toBe("discarded");
      expect(subscriptions).toEqual([]);
    })
);

it.effect(
  "keeps an unknown customer retryable but accepts a tombstoned discard",
  () =>
    Effect.gen(function* () {
      const t = createWebhookTestConvex();
      const missing = {
        email: "unknown@example.com",
        externalId: "auth-unknown",
        id: "polar-unknown",
        metadata: {},
        name: "Unknown User",
      };

      const missingDisposition = yield* Effect.promise(() =>
        t.action((ctx) =>
          runConvexActionProgram(upsertPolarCustomerWebhook(ctx, missing))
        )
      );
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          runConvexProgram(insertCustomerTombstone(ctx, missing.id))
        )
      );
      const discardedDisposition = yield* Effect.promise(() =>
        t.action((ctx) =>
          runConvexActionProgram(upsertPolarCustomerWebhook(ctx, missing))
        )
      );

      expect(missingDisposition).toBe("missing");
      expect(discardedDisposition).toBe("discarded");
    })
);

it.effect("keeps a subscription retryable until its app user exists", () =>
  Effect.gen(function* () {
    const t = createWebhookTestConvex();
    const subscription = buildSubscription("polar-unknown", "unknown");
    polarGateway.getCustomerById.mockReturnValue(
      Effect.succeed({
        email: "unknown@example.com",
        externalId: "auth-unknown",
        id: subscription.customerId,
        metadata: {},
        name: "Unknown User",
      })
    );

    const disposition = yield* Effect.promise(() =>
      t.action((ctx) =>
        runConvexActionProgram(
          upsertPolarSubscriptionWebhook(ctx, subscription, "create")
        )
      )
    );
    const subscriptions = yield* Effect.promise(() =>
      t.query((ctx) =>
        runConvexProgram(
          Effect.promise(() => ctx.db.query("subscriptions").collect())
        )
      )
    );

    expect(disposition).toBe("missing");
    expect(subscriptions).toEqual([]);
  })
);

it.effect(
  "fails closed when Polar metadata and external identity disagree",
  () =>
    Effect.gen(function* () {
      const t = createWebhookTestConvex();
      const metadataUserId = yield* Effect.promise(() =>
        t.mutation((ctx) => runConvexProgram(insertUser(ctx, "metadata-owner")))
      );
      yield* Effect.promise(() =>
        t.mutation((ctx) => runConvexProgram(insertUser(ctx, "external-owner")))
      );

      const disposition = yield* Effect.promise(() =>
        t.action((ctx) =>
          runConvexActionProgram(
            upsertPolarCustomerWebhook(ctx, {
              email: "conflict@example.com",
              externalId: "auth-external-owner",
              id: "polar-conflict",
              metadata: { userId: metadataUserId },
              name: "Conflicting User",
            })
          )
        )
      );
      const customers = yield* Effect.promise(() =>
        t.query((ctx) =>
          runConvexProgram(
            Effect.promise(() => ctx.db.query("customers").collect())
          )
        )
      );

      expect(disposition).toBe("missing");
      expect(customers).toEqual([]);
    })
);
it.each(["customer.created", "customer.updated", "customer.deleted"] as const)(
  "dispatches verified %s with lifecycle fencing",
  async (type) => {
    const t = createWebhookTestConvex();
    const userId = await t.mutation((ctx) =>
      runConvexProgram(insertUser(ctx, "dispatch"))
    );
    const data = {
      ...polarSubscription.customer,
      email: "dispatch@example.com",
      externalId: null,
      metadata: { userId },
    };
    expect(
      await t.action((ctx) =>
        runConvexActionProgram(
          processPolarWebhookEvent(ctx, {
            type,
            timestamp: new Date(NOW),
            data,
          })
        )
      )
    ).toBe(true);
    const state = await t.query((ctx) =>
      runConvexProgram(readWebhookState(ctx))
    );
    expect(state.customers).toHaveLength(type === "customer.deleted" ? 0 : 1);
  }
);

it.each([
  "subscription.created",
  "subscription.updated",
  "subscription.active",
  "subscription.canceled",
  "subscription.past_due",
  "subscription.uncanceled",
  "subscription.revoked",
] as const)(
  "dispatches verified %s through current Polar identity",
  async (type) => {
    const t = createWebhookTestConvex();
    const userId = await t.mutation((ctx) =>
      runConvexProgram(insertUser(ctx, "dispatch"))
    );
    polarGateway.getCustomerById.mockReturnValue(
      Effect.succeed({
        email: "dispatch@example.com",
        externalId: "auth-dispatch",
        id: polarSubscription.customerId,
        metadata: { userId },
        name: "Dispatch",
      })
    );
    expect(
      await t.action((ctx) =>
        runConvexActionProgram(
          processPolarWebhookEvent(ctx, {
            type,
            timestamp: new Date(NOW),
            data: polarSubscription,
          })
        )
      )
    ).toBe(true);
    const state = await t.query((ctx) =>
      runConvexProgram(readWebhookState(ctx))
    );
    expect(state.subscriptions).toMatchObject([
      {
        id: polarSubscription.id,
        currentPeriodEnd: polarSubscription.currentPeriodEnd.toISOString(),
      },
    ]);
  }
);

it("acknowledges unrelated verified product events without billing writes", async () => {
  const t = createWebhookTestConvex();
  expect(
    await t.action((ctx) =>
      runConvexActionProgram(
        processPolarWebhookEvent(ctx, {
          type: "product.updated",
          timestamp: new Date(NOW),
          data: polarSubscription.product,
        })
      )
    )
  ).toBe(true);
  expect(
    await t.query((ctx) => runConvexProgram(readWebhookState(ctx)))
  ).toEqual({ customers: [], subscriptions: [] });
});

it.each(["prepared", "deleted", "unavailable"] as const)(
  "honors customer lookup and write outcomes: %s",
  async (kind) => {
    const t = createWebhookTestConvex();
    const userId = await t.mutation((ctx) =>
      runConvexProgram(insertUser(ctx, "race"))
    );
    const result = await t.action((ctx) => {
      if (kind === "unavailable") {
        vi.spyOn(ctx, "runQuery").mockRejectedValueOnce(
          new Error("database unavailable")
        );
      } else {
        vi.spyOn(ctx, "runMutation").mockResolvedValueOnce({ kind });
      }
      const program = upsertPolarCustomerWebhook(ctx, {
        email: "race@example.com",
        externalId: "auth-race",
        id: "race",
        metadata: { userId },
        name: "Race",
      });
      return runConvexActionProgram(
        program.pipe(
          Effect.match({
            onFailure: (error) => ({
              code: error.code,
              message: error.message,
            }),
            onSuccess: (disposition) => disposition,
          })
        )
      );
    });
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
  }
);
