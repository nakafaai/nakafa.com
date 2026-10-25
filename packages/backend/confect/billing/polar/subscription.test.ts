import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { proProductIds } from "@repo/backend/confect/billing/polar/catalog";
import { decodePolarSubscription } from "@repo/backend/confect/billing/polar/payload";
import {
  polarGrantAction,
  polarSubscriptionState,
} from "@repo/backend/confect/billing/polar/subscription";
import { Effect, Option, Schema } from "effect";

const ACCOUNT_ID = Schema.decodeUnknownSync(Id("billingAccounts"))("account_1");
const NOW = Date.UTC(2026, 9, 25, 12, 0, 0);

/** One Polar subscription wire body, a monthly Pro subscription, with the fields a test changes. */
function wire(overrides: Record<string, unknown> = {}) {
  return {
    cancel_at_period_end: false,
    created_at: "2026-10-01T00:00:00.000Z",
    current_period_end: "2026-11-01T00:00:00.000Z",
    current_period_start: "2026-10-01T00:00:00.000Z",
    customer_id: "cust_polar_1",
    ended_at: null,
    id: "sub_polar_1",
    modified_at: "2026-10-02T00:00:00.000Z",
    price_id: null,
    product_id: proProductIds.sandbox,
    recurring_interval: "month",
    status: "active",
    ...overrides,
  };
}

/** The billing state a Polar wire body maps to, or none when the mapping names no offer. */
const stateOf = Effect.fn("billing.polar.subscription.test.stateOf")(function* (
  overrides: Record<string, unknown> = {}
) {
  const subscription = yield* decodePolarSubscription(wire(overrides));
  return Option.getOrNull(polarSubscriptionState(ACCOUNT_ID, subscription));
});

describe("billing/polar/subscription", () => {
  it.effect(
    "maps an active monthly Pro subscription onto the billing model",
    () =>
      Effect.gen(function* () {
        expect(yield* stateOf()).toEqual({
          accountId: ACCOUNT_ID,
          cancelAtPeriodEnd: false,
          currentPeriodEnd: Date.parse("2026-11-01T00:00:00.000Z"),
          currentPeriodStart: Date.parse("2026-10-01T00:00:00.000Z"),
          offer: "pro.monthly",
          provider: {
            kind: "polar",
            priceId: null,
            productId: proProductIds.sandbox,
            subscriptionId: "sub_polar_1",
          },
          providerUpdatedAt: Date.parse("2026-10-02T00:00:00.000Z"),
          quantity: 1,
          status: "active",
        });
      })
  );

  it.effect(
    "maps a yearly Pro subscription to the yearly offer and keeps the price it names",
    () =>
      Effect.gen(function* () {
        expect(
          yield* stateOf({
            price_id: "price_yearly",
            recurring_interval: "year",
          })
        ).toMatchObject({
          offer: "pro.yearly",
          provider: { priceId: "price_yearly" },
        });
      })
  );

  it.effect("dates a never-modified subscription by its creation", () =>
    Effect.gen(function* () {
      expect(yield* stateOf({ modified_at: null })).toMatchObject({
        providerUpdatedAt: Date.parse("2026-10-01T00:00:00.000Z"),
      });
    })
  );

  it.effect("keeps an open-ended subscription without a period end", () =>
    Effect.gen(function* () {
      expect(yield* stateOf({ current_period_end: null })).toMatchObject({
        currentPeriodEnd: null,
      });
    })
  );

  it.effect.each([
    ["trialing", "active"],
    ["past_due", "pastDue"],
    ["unpaid", "pastDue"],
    ["canceled", "canceled"],
    ["incomplete_expired", "ended"],
    ["incomplete", "pending"],
  ])("maps Polar status %s to %s", ([polarStatus, status]) =>
    Effect.gen(function* () {
      expect(yield* stateOf({ status: polarStatus })).toMatchObject({ status });
    })
  );

  it.effect(
    "ends a canceled subscription once Polar records when it ended",
    () =>
      Effect.gen(function* () {
        expect(
          yield* stateOf({
            ended_at: "2026-10-20T00:00:00.000Z",
            status: "canceled",
          })
        ).toMatchObject({ status: "ended" });
      })
  );

  it.effect(
    "maps no state for a product that is not Pro, or an interval that sells no offer",
    () =>
      Effect.gen(function* () {
        expect(yield* stateOf({ product_id: "another-product" })).toBeNull();
        expect(yield* stateOf({ recurring_interval: "week" })).toBeNull();
      })
  );

  it.effect.each([
    { label: "an active subscription", overrides: { status: "active" } },
    { label: "a trialing subscription", overrides: { status: "trialing" } },
  ])("writes the paid period for $label", ({ overrides }) =>
    Effect.gen(function* () {
      const subscription = yield* decodePolarSubscription(wire(overrides));
      expect(polarGrantAction(subscription, NOW)).toEqual({ kind: "window" });
    })
  );

  it.effect(
    "ends a failed renewal at the failure, not at the period Polar advanced to",
    () =>
      Effect.gen(function* () {
        const subscription = yield* decodePolarSubscription(
          wire({
            current_period_end: "2026-12-01T00:00:00.000Z",
            past_due_at: "2026-11-01T00:00:00.000Z",
            status: "past_due",
          })
        );
        expect(polarGrantAction(subscription, NOW)).toEqual({
          endsAt: Date.parse("2026-11-01T00:00:00.000Z"),
          kind: "endAt",
        });
      })
  );

  it.effect(
    "ends an unpaid subscription at now when Polar sends no failure time",
    () =>
      Effect.gen(function* () {
        const subscription = yield* decodePolarSubscription(
          wire({ status: "unpaid" })
        );
        expect(polarGrantAction(subscription, NOW)).toEqual({
          endsAt: NOW,
          kind: "endAt",
        });
      })
  );

  it.effect(
    "ends a canceled subscription at the time it ended, and at now when Polar sends none",
    () =>
      Effect.gen(function* () {
        const ended = yield* decodePolarSubscription(
          wire({ ended_at: "2026-10-20T00:00:00.000Z", status: "canceled" })
        );
        expect(polarGrantAction(ended, NOW)).toEqual({
          endsAt: Date.parse("2026-10-20T00:00:00.000Z"),
          kind: "endAt",
        });
        const undated = yield* decodePolarSubscription(
          wire({ status: "canceled" })
        );
        expect(polarGrantAction(undated, NOW)).toEqual({
          endsAt: NOW,
          kind: "endAt",
        });
      })
  );

  it.effect.each(["incomplete", "incomplete_expired", "some_future_status"])(
    "ends any grant now for a %s subscription, which never granted Pro",
    (status) =>
      Effect.gen(function* () {
        const subscription = yield* decodePolarSubscription(wire({ status }));
        expect(polarGrantAction(subscription, NOW)).toEqual({
          endsAt: NOW,
          kind: "endAt",
        });
      })
  );
});
