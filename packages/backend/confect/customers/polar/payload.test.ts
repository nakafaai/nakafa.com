import { describe, expect, it } from "@effect/vitest";
import type { models } from "@polar-sh/sdk/2026-04";
import {
  decodePolarCheckout,
  decodePolarCustomer,
  decodePolarCustomerPage,
  decodePolarCustomerSession,
  PolarPayloadError,
} from "@repo/backend/confect/customers/polar/payload";
import { Effect } from "effect";

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
});
