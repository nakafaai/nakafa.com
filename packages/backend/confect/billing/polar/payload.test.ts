import { describe, expect, it } from "@effect/vitest";
import {
  decodePolarCheckout,
  decodePolarCustomer,
  decodePolarCustomerSession,
  decodePolarEnvelope,
  decodePolarSubscription,
} from "@repo/backend/confect/billing/polar/payload";
import { encodeJsonText } from "@repo/utilities/json";
import { Effect, Exit, Option } from "effect";

/** One Polar subscription as the webhook sends it. */
const subscriptionWire = {
  cancel_at_period_end: false,
  created_at: "2026-10-01T00:00:00.000Z",
  current_period_end: "2026-11-01T00:00:00.000Z",
  current_period_start: "2026-10-01T00:00:00.000Z",
  customer_id: "cust_polar_1",
  ended_at: null,
  id: "sub_polar_1",
  modified_at: null,
  price_id: "price_polar_1",
  product_id: "product_polar_1",
  recurring_interval: "month",
  status: "active",
};

describe("billing/polar/payload", () => {
  it.effect(
    "decodes an individual customer and reads a missing email, external ID, and name as null",
    () =>
      Effect.gen(function* () {
        expect(
          yield* decodePolarCustomer({
            email: "learner@example.com",
            external_id: "user-1",
            id: "cust_1",
            name: "Learner",
            type: "individual",
          })
        ).toEqual({
          email: "learner@example.com",
          externalId: "user-1",
          id: "cust_1",
          name: "Learner",
        });
        expect(
          yield* decodePolarCustomer({ id: "cust_2", type: "team" })
        ).toEqual({
          email: null,
          externalId: null,
          id: "cust_2",
          name: null,
        });
      })
  );

  it.effect("refuses a customer without a type", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(decodePolarCustomer({ id: "cust_3" }));
      expect(Exit.isFailure(exit)).toBe(true);
    })
  );

  it.effect("decodes a checkout URL and a customer portal URL", () =>
    Effect.gen(function* () {
      expect(
        yield* decodePolarCheckout({ url: "https://checkout.polar.sh/c" })
      ).toEqual({ url: "https://checkout.polar.sh/c" });
      expect(
        yield* decodePolarCustomerSession({
          customer_portal_url: "https://polar.sh/portal",
        })
      ).toEqual({ url: "https://polar.sh/portal" });
    })
  );

  it.effect("refuses a checkout or portal response without its URL", () =>
    Effect.gen(function* () {
      expect(Exit.isFailure(yield* Effect.exit(decodePolarCheckout({})))).toBe(
        true
      );
      expect(
        Exit.isFailure(yield* Effect.exit(decodePolarCustomerSession({})))
      ).toBe(true);
    })
  );

  it.effect(
    "decodes a subscription with its dates as Date values and its optional price",
    () =>
      Effect.gen(function* () {
        const subscription = yield* decodePolarSubscription(subscriptionWire);
        expect(subscription).toMatchObject({
          cancelAtPeriodEnd: false,
          customerId: "cust_polar_1",
          id: "sub_polar_1",
          priceId: "price_polar_1",
          productId: "product_polar_1",
          recurringInterval: "month",
          status: "active",
        });
        expect(subscription.currentPeriodEnd?.toISOString()).toBe(
          "2026-11-01T00:00:00.000Z"
        );
        const { price_id: _priceId, ...withoutPriceWire } = subscriptionWire;
        const withoutPrice = yield* decodePolarSubscription(withoutPriceWire);
        expect(withoutPrice.priceId).toBeUndefined();
      })
  );

  it.effect("refuses a subscription whose period start is not a date", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        decodePolarSubscription({
          ...subscriptionWire,
          current_period_start: "not-a-date",
        })
      );
      expect(Exit.isFailure(exit)).toBe(true);
    })
  );

  it("reads the event type and its data from a stored body, and none from a body that names no event", () => {
    expect(
      Option.map(
        decodePolarEnvelope(
          encodeJsonText({
            data: { id: "sub_1" },
            type: "subscription.created",
          })
        ),
        (envelope) => envelope.type
      )
    ).toEqual(Option.some("subscription.created"));
    expect(Option.isNone(decodePolarEnvelope("not json"))).toBe(true);
    expect(
      Option.isNone(decodePolarEnvelope(encodeJsonText({ data: {} })))
    ).toBe(true);
  });
});
