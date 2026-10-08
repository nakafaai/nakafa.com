import { describe, expect, it } from "@effect/vitest";
import { decodePolarSubscription } from "@repo/backend/confect/customers/polar/payload";
import { convertToDatabaseSubscription } from "@repo/backend/confect/subscriptions/utils";
import { Effect } from "effect";

const subscriptionWire = {
  amount: 1000,
  cancel_at_period_end: false,
  checkout_id: null,
  created_at: "2026-09-01T00:00:00Z",
  currency: "usd",
  current_period_end: "2026-10-01T00:00:00.123456Z",
  current_period_start: "2026-09-01T00:00:00Z",
  customer_cancellation_comment: null,
  customer_cancellation_reason: null,
  customer_id: "customer-1",
  ended_at: null,
  id: "subscription-1",
  metadata: {},
  modified_at: null,
  product_id: "product-1",
  recurring_interval: "month",
  started_at: null,
  status: "active",
};

/** Decodes one Polar subscription payload with overrides, then converts it for storage. */
const storedFrom = Effect.fn("subscriptions.test.storedFrom")(function* (
  overrides: Record<string, unknown>
) {
  return convertToDatabaseSubscription(
    yield* decodePolarSubscription({ ...subscriptionWire, ...overrides })
  );
});

describe("Polar subscription persistence", () => {
  it.effect(
    "stores each date as the ISO string the tryout access query compares, byte for byte",
    () =>
      Effect.gen(function* () {
        expect(yield* storedFrom({})).toStrictEqual({
          amount: 1000,
          cancelAtPeriodEnd: false,
          checkoutId: null,
          createdAt: "2026-09-01T00:00:00.000Z",
          currency: "usd",
          currentPeriodEnd: "2026-10-01T00:00:00.123Z",
          currentPeriodStart: "2026-09-01T00:00:00.000Z",
          customerCancellationComment: null,
          customerCancellationReason: null,
          customerId: "customer-1",
          endedAt: null,
          id: "subscription-1",
          metadata: {},
          modifiedAt: null,
          productId: "product-1",
          recurringInterval: "month",
          startedAt: null,
          status: "active",
        });
      })
  );

  it.effect("retains school identity and populated lifecycle timestamps", () =>
    Effect.gen(function* () {
      expect(
        yield* storedFrom({
          ended_at: "2026-09-15T12:00:00Z",
          metadata: { schoolId: "school-1" },
          modified_at: "2026-09-02T08:30:00Z",
          started_at: "2026-09-01T00:00:00Z",
        })
      ).toMatchObject({
        endedAt: "2026-09-15T12:00:00.000Z",
        modifiedAt: "2026-09-02T08:30:00.000Z",
        schoolId: "school-1",
        startedAt: "2026-09-01T00:00:00.000Z",
      });
    })
  );

  it.effect.each(["", 123, false])(
    "omits invalid school metadata %s",
    (schoolId) =>
      Effect.gen(function* () {
        expect(
          yield* storedFrom({ metadata: { schoolId } })
        ).not.toHaveProperty("schoolId");
      })
  );

  it.effect.each(["", "unknown-interval"])(
    "normalizes the unsupported interval %s to null",
    (recurring_interval) =>
      Effect.gen(function* () {
        expect(
          (yield* storedFrom({ recurring_interval })).recurringInterval
        ).toBeNull();
      })
  );
});
