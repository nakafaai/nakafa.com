import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { ensureProviderCustomer } from "@repo/backend/confect/billing/customer";
import { polarGateway } from "@repo/backend/confect/billing/polar/live";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { MASCOT } from "@repo/backend/test/mascot";
import { Effect, Schema } from "effect";

vi.mock("@repo/backend/confect/billing/polar/live", () => ({
  polarGateway: {
    createCustomer: vi.fn(),
    getCustomerByExternalId: vi.fn(),
    updateCustomer: vi.fn(),
  },
}));

const NOW = Date.UTC(2026, 9, 25, 12, 0, 0);

/** Inserts one active user, or one that is deleting when `deleting` is set. */
const seedUser = Effect.fn("billing.customer.test.seedUser")(function* (
  deleting: boolean
) {
  const writer = yield* DatabaseWriter;
  return yield* writer.table("users").insert({
    authId: `auth-customer-${deleting ? "deleting" : "active"}`,
    credits: 0,
    creditsResetAt: NOW,
    ...(deleting ? { deletionPreparedAt: NOW } : {}),
    email: "customer@example.com",
    mascot: MASCOT,
    name: "Customer",
    plan: "free",
  });
});

describe("billing/customer", () => {
  it.effect(
    "refuses a Polar customer for a user whose deletion is being prepared",
    () =>
      Effect.gen(function* () {
        const test = yield* Confect.pipe(Effect.provide(confectLayer));
        const userId = yield* test.run(seedUser(true), Id("users"));
        const refusal = yield* test.run(
          ensureProviderCustomer(userId).pipe(
            Effect.match({
              onFailure: (error) => error._tag,
              onSuccess: () => "linked",
            })
          ),
          Schema.String
        );
        expect(refusal).toBe("CheckoutUnavailable");
        expect(polarGateway.createCustomer).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "returns the customer already linked to the account without asking Polar",
    () =>
      Effect.gen(function* () {
        const test = yield* Confect.pipe(Effect.provide(confectLayer));
        const userId = yield* test.run(seedUser(false), Id("users"));
        vi.mocked(polarGateway.getCustomerByExternalId).mockReturnValueOnce(
          Effect.succeed({
            email: "customer@example.com",
            id: "polar-linked",
            name: "Customer",
            externalId: "auth-customer-active",
          })
        );
        expect(
          yield* test.run(ensureProviderCustomer(userId), Schema.String)
        ).toBe("polar-linked");
        expect(
          yield* test.run(ensureProviderCustomer(userId), Schema.String)
        ).toBe("polar-linked");
        expect(polarGateway.getCustomerByExternalId).toHaveBeenCalledOnce();
      })
  );
});
