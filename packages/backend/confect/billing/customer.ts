import type { Docs } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import {
  MutationRunner,
  QueryRunner,
} from "@repo/backend/confect/_generated/services";
import {
  accountUnavailableCode,
  accountUnavailableMessage,
} from "@repo/backend/confect/auth/spec";
import { polarGateway } from "@repo/backend/confect/billing/polar/live";
import type {
  PolarCustomerIdentity,
  PolarDuplicateEmailError,
} from "@repo/backend/confect/billing/polar/spec";
import {
  CheckoutUnavailable,
  checkoutSessionIoError,
} from "@repo/backend/confect/billing/spec";
import { Effect, flow } from "effect";

/**
 * Takes over the Polar customer that refused a new one because it already holds the user's email
 * address, when the user may adopt it. Polar keeps an external ID once set, so only a customer
 * without one is given the user's ID; a customer left by a removed account keeps its old one and
 * is linked by its Polar ID, which every webhook and the deletion read. Any other refusal stands.
 */
const adoptCustomerByEmail = Effect.fn("billing.customer.adoptByEmail")(
  function* (
    userId: Docs["users"]["_id"],
    identity: PolarCustomerIdentity,
    duplicate: PolarDuplicateEmailError
  ) {
    const held = yield* polarGateway.findCustomerByEmail(identity.email);
    if (held === null) {
      return yield* duplicate;
    }
    const { runQuery } = yield* QueryRunner;
    const mayAdopt = yield* runQuery(
      refs.internal.billing.checkout.mayAdoptCustomer,
      { externalId: held.externalId, userId }
    ).pipe(
      Effect.mapError(checkoutSessionIoError),
      Effect.catchDefect(flow(checkoutSessionIoError, Effect.fail))
    );
    if (!mayAdopt) {
      return yield* duplicate;
    }
    if (held.externalId === null) {
      return yield* polarGateway.updateCustomer({
        customerId: held.id,
        identity,
      });
    }
    return held;
  }
);

/**
 * Links the Polar customer of a Nakafa user to the identity Nakafa holds. Polar
 * finds the customer by its external ID, which is the Better Auth user ID: the
 * external ID every customer created before billing accounts carries, so those
 * customers are reused rather than duplicated. A customer that Polar already
 * holds is updated only where its email or name has drifted, and one that holds
 * the email under another external ID is adopted when the user may adopt it.
 */
const linkPolarCustomer = Effect.fn("billing.customer.link")(function* (
  userId: Docs["users"]["_id"],
  identity: PolarCustomerIdentity
) {
  const existing = yield* polarGateway.getCustomerByExternalId(
    identity.externalId
  );
  if (existing === null) {
    return yield* polarGateway
      .createCustomer(identity)
      .pipe(
        Effect.catchTag("PolarDuplicateEmailError", (duplicate) =>
          adoptCustomerByEmail(userId, identity, duplicate)
        )
      );
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
  const customer = yield* linkPolarCustomer(userId, {
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
