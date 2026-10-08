import { describe, expect, it } from "@effect/vitest";
import type { models } from "@polar-sh/sdk/2026-04";
import {
  decodePolarCheckout,
  decodePolarCustomer,
  decodePolarCustomerPage,
  decodePolarCustomerRecord,
  decodePolarCustomerSession,
  decodePolarSubscription,
  PolarPayloadError,
} from "@repo/backend/confect/customers/polar/payload";
import { Effect, Struct } from "effect";

const individual = {
  avatar_url: null,
  billing_address: null,
  billing_name: null,
  created_at: "2026-09-01T00:00:00Z",
  deleted_at: null,
  email: "learner@example.com",
  email_verified: true,
  external_id: "user-1",
  first_user_event_at: null,
  id: "customer-1",
  metadata: { userId: "user-1" },
  modified_at: null,
  name: "Learner",
  organization_id: "organization-1",
  tax_id: null,
  type: "individual",
} satisfies models.CustomerIndividual;

const decoded = {
  email: "learner@example.com",
  externalId: "user-1",
  id: "customer-1",
  metadata: { userId: "user-1" },
  name: "Learner",
};

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
  metadata: { schoolId: "school-1" },
  modified_at: null,
  product_id: "product-1",
  recurring_interval: "month",
  started_at: "2026-09-01T00:00:00Z",
  status: "active",
};

describe("Polar payload contracts", () => {
  it.effect("decodes a customer into the fields the handlers read", () =>
    Effect.gen(function* () {
      expect(yield* decodePolarCustomer(individual)).toEqual(decoded);
    })
  );

  it.effect(
    "keeps a team customer without an email for the normalizer to reject",
    () =>
      Effect.gen(function* () {
        const customer = yield* decodePolarCustomer({
          ...individual,
          email: null,
          type: "team",
        });
        expect(customer).toEqual({ ...decoded, email: null });
      })
  );

  it.effect("rejects an individual customer whose email is absent", () =>
    Effect.gen(function* () {
      const failure = yield* decodePolarCustomer(
        Struct.omit(individual, ["email"])
      ).pipe(Effect.flip);
      expect(failure).toBeInstanceOf(PolarPayloadError);
    })
  );

  it.effect("rejects an individual customer whose email is null", () =>
    Effect.gen(function* () {
      const failure = yield* decodePolarCustomer({
        ...individual,
        email: null,
      }).pipe(Effect.flip);
      expect(failure).toBeInstanceOf(PolarPayloadError);
    })
  );

  it.effect("ignores a customer field the handlers do not read", () =>
    Effect.gen(function* () {
      expect(
        yield* decodePolarCustomer({ ...individual, billing_name: 42 })
      ).toEqual(decoded);
    })
  );

  it.effect("rejects a customer whose required field is missing", () =>
    Effect.gen(function* () {
      const failure = yield* decodePolarCustomer({
        external_id: "user-1",
        id: "customer-1",
        name: "Learner",
      }).pipe(Effect.flip);
      expect(failure).toBeInstanceOf(PolarPayloadError);
      expect(failure.message).toBe(
        "Polar customer payload does not match its contract."
      );
    })
  );

  it.effect(
    "rejects metadata that Convex cannot store as a primitive value",
    () =>
      Effect.gen(function* () {
        const failure = yield* decodePolarCustomer({
          ...individual,
          metadata: { nested: { value: true } },
        }).pipe(Effect.flip);
        expect(failure).toBeInstanceOf(PolarPayloadError);
      })
  );

  it.effect("decodes a whole customer for a deletion, individual or team", () =>
    Effect.gen(function* () {
      expect(yield* decodePolarCustomerRecord(individual)).toMatchObject({
        id: "customer-1",
        type: "individual",
      });
      expect(
        yield* decodePolarCustomerRecord({
          ...individual,
          email: null,
          type: "team",
        })
      ).toMatchObject({ email: null, type: "team" });
    })
  );

  it.effect(
    "rejects a customer deletion with a malformed field that 0.49 checked",
    () =>
      Effect.gen(function* () {
        for (const malformed of [
          { billing_address: { country: 42 } },
          { billing_name: 42 },
          { created_at: 12_345 },
          { created_at: "2026-09-01" },
          { deleted_at: "2026-02-31T00:00:00Z" },
          { email_verified: "yes" },
          { metadata: { nested: { value: true } } },
          { organization_id: null },
          { tax_id: "not-a-list" },
        ]) {
          const failure = yield* decodePolarCustomerRecord({
            ...individual,
            ...malformed,
          }).pipe(Effect.flip);
          expect(failure).toBeInstanceOf(PolarPayloadError);
        }
      })
  );

  it.effect("decodes a customer list and rejects a list without items", () =>
    Effect.gen(function* () {
      const page = yield* decodePolarCustomerPage({
        items: [individual],
        pagination: { max_page: 1, total_count: 1 },
      });
      expect(page).toEqual({ items: [decoded] });
      const failure = yield* decodePolarCustomerPage({
        pagination: { max_page: 0, total_count: 0 },
      }).pipe(Effect.flip);
      expect(failure.message).toBe(
        "Polar customer list payload does not match its contract."
      );
    })
  );

  it.effect("decodes a checkout URL and rejects a checkout without one", () =>
    Effect.gen(function* () {
      expect(
        yield* decodePolarCheckout({ url: "https://checkout.polar.sh/s" })
      ).toEqual({ url: "https://checkout.polar.sh/s" });
      const failure = yield* decodePolarCheckout({}).pipe(Effect.flip);
      expect(failure.message).toBe(
        "Polar checkout payload does not match its contract."
      );
    })
  );

  it.effect(
    "decodes a customer portal URL from its snake_case field and rejects a session without one",
    () =>
      Effect.gen(function* () {
        expect(
          yield* decodePolarCustomerSession({
            customer_portal_url: "https://polar.sh/portal",
          })
        ).toEqual({ url: "https://polar.sh/portal" });
        const failure = yield* decodePolarCustomerSession({}).pipe(Effect.flip);
        expect(failure.message).toBe(
          "Polar customer session payload does not match its contract."
        );
      })
  );

  it.effect("decodes a subscription with its date-times as Date values", () =>
    Effect.gen(function* () {
      const subscription = yield* decodePolarSubscription(subscriptionWire);
      expect(subscription).toMatchObject({
        amount: 1000,
        customerId: "customer-1",
        endedAt: null,
        id: "subscription-1",
        metadata: { schoolId: "school-1" },
        modifiedAt: null,
        productId: "product-1",
        recurringInterval: "month",
        status: "active",
      });
      expect(subscription.createdAt).toEqual(new Date("2026-09-01T00:00:00Z"));
      expect(subscription.currentPeriodEnd).toEqual(
        new Date("2026-10-01T00:00:00.123Z")
      );
      expect(subscription.startedAt).toEqual(new Date("2026-09-01T00:00:00Z"));
    })
  );

  it.effect(
    "keeps an unrecognized recurring interval for the converter to map",
    () =>
      Effect.gen(function* () {
        const subscription = yield* decodePolarSubscription({
          ...subscriptionWire,
          recurring_interval: "fortnight",
        });
        expect(subscription.recurringInterval).toBe("fortnight");
      })
  );

  it.effect("rejects a subscription whose date-time cannot be read", () =>
    Effect.gen(function* () {
      const failure = yield* decodePolarSubscription({
        ...subscriptionWire,
        current_period_end: "not-a-date",
      }).pipe(Effect.flip);
      expect(failure).toBeInstanceOf(PolarPayloadError);
      expect(failure.message).toBe(
        "Polar subscription payload does not match its contract."
      );
    })
  );

  it.effect("rejects a subscription amount that is not an integer", () =>
    Effect.gen(function* () {
      const failure = yield* decodePolarSubscription({
        ...subscriptionWire,
        amount: 10.5,
      }).pipe(Effect.flip);
      expect(failure).toBeInstanceOf(PolarPayloadError);
    })
  );

  it.effect(
    "rejects a subscription date-time that is not RFC 3339 with a zone offset",
    () =>
      Effect.gen(function* () {
        for (const value of [
          "2026-10-01",
          "September 1, 2026",
          "2026-10-01T00:00:00",
          "2026-10-01T00:00Z",
          "2026-10-01T24:00:00Z",
          "2026-02-31T00:00:00Z",
        ]) {
          const failure = yield* decodePolarSubscription({
            ...subscriptionWire,
            current_period_end: value,
          }).pipe(Effect.flip);
          expect(failure).toBeInstanceOf(PolarPayloadError);
        }
      })
  );
});
