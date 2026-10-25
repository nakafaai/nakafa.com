import type { Docs } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import { MutationRunner } from "@repo/backend/confect/_generated/services";
import {
  accountUnavailableCode,
  accountUnavailableMessage,
} from "@repo/backend/confect/auth/spec";
import { polarGateway } from "@repo/backend/confect/billing/polar/live";
import type { PolarCustomerIdentity } from "@repo/backend/confect/billing/polar/spec";
import {
  CheckoutUnavailable,
  checkoutSessionIoError,
} from "@repo/backend/confect/billing/spec";
import { Effect, flow } from "effect";

/**
 * Links the Polar customer of a Nakafa user to the identity Nakafa holds. Polar
 * finds the customer by its external ID, which is the Better Auth user ID: the
 * external ID every customer created before billing accounts carries, so those
 * customers are reused rather than duplicated. A customer that Polar already
 * holds is updated only where its email or name has drifted.
 */
const linkPolarCustomer = Effect.fn("billing.customer.link")(function* (
  identity: PolarCustomerIdentity
) {
  const existing = yield* polarGateway.getCustomerByExternalId(
    identity.externalId
  );
  if (existing === null) {
    return yield* polarGateway.createCustomer(identity);
  }
  if (existing.email === identity.email && existing.name === identity.name) {
    return existing;
  }
  return yield* polarGateway.updateCustomer({
    customerId: existing.id,
    identity,
  });
});

/**
 * Returns the Polar customer ID of one user's personal billing account, opening
 * the account and linking the customer on first use. Checkout and the customer
 * portal both need the customer, so the first of them creates it.
 */
export const ensureProviderCustomer = Effect.fn(
  "billing.customer.ensureProvider"
)(function* (userId: Docs["users"]["_id"]) {
  const { runMutation } = yield* MutationRunner;
  const opened = yield* runMutation(
    refs.internal.billing.checkout.openAccount,
    {
      userId,
    }
  ).pipe(
    Effect.mapError(checkoutSessionIoError),
    Effect.catchDefect(flow(checkoutSessionIoError, Effect.fail))
  );
  if (opened.kind === "unavailable") {
    return yield* new CheckoutUnavailable({
      code: accountUnavailableCode,
      message: accountUnavailableMessage,
    });
  }
  if (opened.providerCustomerId !== null) {
    return opened.providerCustomerId;
  }
  const customer = yield* linkPolarCustomer({
    email: opened.email,
    externalId: opened.authId,
    name: opened.name,
  });
  yield* runMutation(refs.internal.billing.checkout.recordCustomer, {
    accountId: opened.accountId,
    providerCustomerId: customer.id,
  }).pipe(
    Effect.mapError(checkoutSessionIoError),
    Effect.catchDefect(flow(checkoutSessionIoError, Effect.fail))
  );
  return customer.id;
});
