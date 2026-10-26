import refs from "@repo/backend/confect/_generated/refs";
import { MutationRunner } from "@repo/backend/confect/_generated/services";
import { polarGateway } from "@repo/backend/confect/billing/polar/live";
import { UNKNOWN_COUNTRY } from "@repo/backend/confect/billing/route";
import { Effect } from "effect";

/**
 * Links the Polar customer one event or listed subscription names to the Nakafa
 * user its external ID names. The customer is fetched from Polar, so this runs in
 * an action only. A customer Polar no longer holds, or whose external ID names no
 * billable user, stays unknown: it is logged at error level with the customer ID
 * alone, and nothing is linked. Returns whether the customer is linked now.
 */
export const resolvePolarCustomer = Effect.fn("billing.polar.resolveCustomer")(
  function* (customerId: string) {
    const customer = yield* polarGateway.getCustomer(customerId);
    if (customer === null || customer.externalId === null) {
      yield* Effect.logError("Polar customer matches no Nakafa user", {
        customerId,
      });
      return "unresolved" as const;
    }
    const { runMutation } = yield* MutationRunner;
    const outcome = yield* runMutation(
      refs.internal.billing.accounts.linkPolarCustomer,
      {
        authId: customer.externalId,
        // Polar holds no billing address for this customer, so its country is unknown, as the checkout account's is.
        country: customer.billingCountry ?? UNKNOWN_COUNTRY,
        providerCustomerId: customer.id,
      }
    ).pipe(Effect.orDie);
    if (outcome === "linked") {
      return "linked" as const;
    }
    yield* Effect.logError("Polar customer cannot be linked to a Nakafa user", {
      customerId,
      outcome,
    });
    return "unresolved" as const;
  }
);
