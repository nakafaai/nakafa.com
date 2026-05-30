import {
  type EnsurePolarCustomerInput,
  PolarCustomerEmailConflict,
  PolarCustomerError,
  type PolarCustomerGateway,
  type PolarCustomerSource,
  type PolarMetadata,
  type PolarUpdateError,
  polarCustomerEmailConflictCode,
  polarCustomerErrorCode,
  type StoredPolarCustomer,
} from "@repo/backend/convex/customers/polar/spec";
import { Effect, Either } from "effect";

/** Keep only Polar metadata values that can be persisted in Convex. */
function normalizeMetadata(
  metadata: Record<string, unknown> | null | undefined
) {
  const entries = Object.entries(metadata ?? {}).filter(
    (entry): entry is [string, PolarMetadata[string]] => {
      const value = entry[1];

      return (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      );
    }
  );

  return Object.fromEntries(entries);
}

/** Normalizes one Polar customer response into the subset persisted locally. */
export const normalizeStoredCustomer: (
  customer: PolarCustomerSource
) => Effect.Effect<StoredPolarCustomer, PolarCustomerError> = Effect.fn(
  "customers.polar.normalizeStoredCustomer"
)(function* (customer: PolarCustomerSource) {
  if (typeof customer.email !== "string") {
    return yield* Effect.fail(
      new PolarCustomerError({
        code: polarCustomerErrorCode,
        message: `Polar customer ${customer.id} is missing a valid email address.`,
      })
    );
  }

  return {
    email: customer.email,
    externalId: customer.externalId ?? null,
    id: customer.id,
    metadata: normalizeMetadata(customer.metadata),
    name: customer.name ?? null,
  };
});

/** Aligns an existing Polar customer with the app user's current identity. */
export const syncExistingCustomer: (
  gateway: PolarCustomerGateway,
  customer: PolarCustomerSource,
  input: EnsurePolarCustomerInput
) => Effect.Effect<
  StoredPolarCustomer,
  PolarCustomerEmailConflict | PolarCustomerError | PolarUpdateError
> = Effect.fn("customers.polar.syncExistingCustomer")(function* (
  gateway: PolarCustomerGateway,
  customer: PolarCustomerSource,
  input: EnsurePolarCustomerInput
) {
  const storedCustomer = yield* normalizeStoredCustomer(customer);

  if (
    storedCustomer.externalId !== null &&
    storedCustomer.externalId !== input.externalId
  ) {
    return yield* Effect.fail(
      new PolarCustomerEmailConflict({
        code: polarCustomerEmailConflictCode,
        existingExternalId: storedCustomer.externalId,
        message:
          "This email is already linked to a different Polar customer identity.",
        polarCustomerId: storedCustomer.id,
      })
    );
  }

  const currentMetadata = JSON.stringify(storedCustomer.metadata);
  const nextMetadata = JSON.stringify(input.metadata ?? {});
  const alreadySynced =
    storedCustomer.email === input.email &&
    storedCustomer.name === input.name &&
    currentMetadata === nextMetadata &&
    storedCustomer.externalId === input.externalId;

  if (alreadySynced) {
    return storedCustomer;
  }

  const updatedCustomer = yield* gateway.updateCustomer({
    customer: storedCustomer,
    next: input,
  });

  return yield* normalizeStoredCustomer(updatedCustomer);
});

/** Relinks a Polar customer found by email after Polar rejects duplicate creates. */
const syncExistingCustomerByEmail = Effect.fn(
  "customers.polar.syncExistingCustomerByEmail"
)(function* (gateway: PolarCustomerGateway, input: EnsurePolarCustomerInput) {
  const customer = yield* gateway.findCustomerByEmail(input.email);

  if (!customer) {
    return null;
  }

  return yield* syncExistingCustomer(gateway, customer, input);
});

/**
 * Finds or creates the Polar customer for one app user, preserving duplicate
 * email recovery and external-id race recovery in one Effect flow.
 */
export const ensureCustomer: (
  gateway: PolarCustomerGateway,
  input: EnsurePolarCustomerInput
) => Effect.Effect<
  StoredPolarCustomer,
  PolarCustomerEmailConflict | PolarCustomerError | PolarUpdateError
> = Effect.fn("customers.polar.ensureCustomer")(function* (
  gateway: PolarCustomerGateway,
  input: EnsurePolarCustomerInput
) {
  if (input.localCustomerId) {
    const localCustomer = yield* gateway.getCustomerById(input.localCustomerId);

    if (localCustomer) {
      return yield* syncExistingCustomer(gateway, localCustomer, input);
    }
  }

  const externalCustomer = yield* gateway.getCustomerByExternalId(
    input.externalId
  );

  if (externalCustomer) {
    return yield* syncExistingCustomer(gateway, externalCustomer, input);
  }

  const createAttempt = yield* Effect.either(gateway.createCustomer(input));

  if (Either.isRight(createAttempt)) {
    return yield* normalizeStoredCustomer(createAttempt.right);
  }

  if (createAttempt.left._tag === "PolarDuplicateEmailError") {
    const existingEmailCustomer = yield* syncExistingCustomerByEmail(
      gateway,
      input
    );

    if (existingEmailCustomer) {
      return existingEmailCustomer;
    }
  }

  const racedCustomer = yield* gateway.getCustomerByExternalId(
    input.externalId
  );

  if (racedCustomer) {
    return yield* syncExistingCustomer(gateway, racedCustomer, input);
  }

  return yield* Effect.fail(
    new PolarCustomerError({
      code: polarCustomerErrorCode,
      message: createAttempt.left.message,
    })
  );
});
