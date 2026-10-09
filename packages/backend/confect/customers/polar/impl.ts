import type { PolarCustomerSource } from "@repo/backend/confect/customers/polar/payload";
import {
  type EnsurePolarCustomerInput,
  PolarCustomerEmailConflict,
  PolarCustomerError,
  type PolarCustomerGateway,
  type PolarUpdateError,
  polarCustomerEmailConflictCode,
  polarCustomerErrorCode,
  type StoredPolarCustomer,
} from "@repo/backend/confect/customers/polar/spec";
import { encodeJsonText } from "@repo/utilities/json";
import { Effect, Result } from "effect";

/** Normalizes one decoded Polar customer into the subset persisted locally. */
export const normalizeStoredCustomer: (
  customer: PolarCustomerSource
) => Effect.Effect<StoredPolarCustomer, PolarCustomerError> = Effect.fn(
  "customers.polar.normalizeStoredCustomer"
)(function* (customer: PolarCustomerSource) {
  if (typeof customer.email !== "string") {
    return yield* new PolarCustomerError({
      code: polarCustomerErrorCode,
      message: `Polar customer ${customer.id} is missing a valid email address.`,
    });
  }
  return {
    email: customer.email,
    externalId: customer.externalId ?? null,
    id: customer.id,
    metadata: customer.metadata,
    name: customer.name,
  };
});
/** Aligns an existing Polar customer with the app user's current identity. */
const syncExistingCustomer: (
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
    return yield* new PolarCustomerEmailConflict({
      code: polarCustomerEmailConflictCode,
      existingExternalId: storedCustomer.externalId,
      message:
        "This email is already linked to a different Polar customer identity.",
      polarCustomerId: storedCustomer.id,
    });
  }
  const currentMetadata = encodeJsonText(storedCustomer.metadata);
  const nextMetadata = encodeJsonText(input.metadata ?? {});
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
  const createAttempt = yield* Effect.result(gateway.createCustomer(input));
  if (Result.isSuccess(createAttempt)) {
    return yield* normalizeStoredCustomer(createAttempt.success);
  }
  if (createAttempt.failure._tag === "PolarDuplicateEmailError") {
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
  return yield* new PolarCustomerError({
    code: polarCustomerErrorCode,
    message: createAttempt.failure.message,
  });
});
