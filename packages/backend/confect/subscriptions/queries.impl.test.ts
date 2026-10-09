import { afterEach, expect, it } from "@effect/vitest";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { api } from "@repo/backend/convex/_generated/api";

const NOW = Date.UTC(2026, 9, 8, 12, 0, 0);

afterEach(() => {
  vi.useRealTimers();
});

it("requires a session and grants subscription UI access only for the current customer's active product", async () => {
  vi.setSystemTime(NOW);
  const t = createConvexTestWithBetterAuth();
  const query = api.subscriptions.queries.hasActiveSubscription;
  const args = { productId: "pro-product" };
  await expect(t.query(query, args)).rejects.toMatchObject({
    data: {
      _tag: "SessionRequired",
      code: "UNAUTHENTICATED",
      message: "Unauthenticated",
    },
  });
  const identity = await t.mutation((ctx) =>
    seedAuthenticatedUser(ctx, { now: NOW })
  );
  const authed = t.withIdentity({
    subject: identity.authUserId,
    sessionId: identity.sessionId,
  });
  await expect(authed.query(query, args)).resolves.toBe(false);
  await t.mutation((ctx) =>
    ctx.db.insert("customers", {
      userId: identity.userId,
      id: "customer-current",
      externalId: identity.authUserId,
    })
  );
  const subscriptionId = await t.mutation((ctx) =>
    ctx.db.insert("subscriptions", {
      id: "subscription",
      customerId: "customer-other",
      productId: "pro-product",
      status: "active",
      createdAt: "2026-09-27T00:00:00.000Z",
      currentPeriodStart: "2026-09-27T00:00:00.000Z",
      currentPeriodEnd: null,
      modifiedAt: null,
      amount: null,
      currency: null,
      recurringInterval: null,
      cancelAtPeriodEnd: false,
      startedAt: null,
      endedAt: null,
      checkoutId: null,
      metadata: {},
    })
  );
  await expect(authed.query(query, args)).resolves.toBe(false);
  await t.mutation((ctx) =>
    ctx.db.patch("subscriptions", subscriptionId, {
      customerId: "customer-current",
      status: "canceled",
    })
  );
  await expect(authed.query(query, args)).resolves.toBe(false);
  await t.mutation((ctx) =>
    ctx.db.patch("subscriptions", subscriptionId, {
      status: "active",
      productId: "other-product",
    })
  );
  await expect(authed.query(query, args)).resolves.toBe(false);
  await t.mutation((ctx) =>
    ctx.db.patch("subscriptions", subscriptionId, {
      productId: "pro-product",
      cancelAtPeriodEnd: true,
    })
  );
  await expect(authed.query(query, args)).resolves.toBe(true);
});
