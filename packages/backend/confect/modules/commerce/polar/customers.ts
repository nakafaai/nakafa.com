import { checkoutsCreate } from "@polar-sh/sdk/funcs/checkoutsCreate.js";
import { customerSessionsCreate } from "@polar-sh/sdk/funcs/customerSessionsCreate.js";
import { customersCreate } from "@polar-sh/sdk/funcs/customersCreate.js";
import { customersDelete } from "@polar-sh/sdk/funcs/customersDelete.js";
import { customersGet } from "@polar-sh/sdk/funcs/customersGet.js";
import { customersGetExternal } from "@polar-sh/sdk/funcs/customersGetExternal.js";
import { customersList } from "@polar-sh/sdk/funcs/customersList.js";
import { customersUpdate } from "@polar-sh/sdk/funcs/customersUpdate.js";
import type { Customer } from "@polar-sh/sdk/models/components/customer.js";
import { HTTPValidationError } from "@polar-sh/sdk/models/errors/httpvalidationerror.js";
import { PolarError } from "@polar-sh/sdk/models/errors/polarerror.js";
import type { Result } from "@polar-sh/sdk/types/fp.js";
import { makePolarClient } from "@repo/backend/confect/modules/commerce/polar/client";
import { Effect, Schema } from "effect";

export type PolarMetadata = Record<string, string | number | boolean>;

export interface NormalizedPolarCustomer {
  readonly email: string;
  readonly externalId: string | null;
  readonly id: string;
  readonly metadata: PolarMetadata;
  readonly name: string | null;
}

interface EnsurePolarCustomerArgs {
  readonly email: string;
  readonly externalId: string;
  readonly localCustomerId?: string;
  readonly metadata: PolarMetadata;
  readonly name: string;
}

export class PolarCustomerError extends Schema.TaggedError<PolarCustomerError>()(
  "PolarCustomerError",
  {
    detail: Schema.optional(Schema.String),
    message: Schema.String,
  }
) {}

export class PolarCustomerEmailConflict extends Schema.TaggedError<PolarCustomerEmailConflict>()(
  "PolarCustomerEmailConflict",
  {
    existingExternalId: Schema.Union(Schema.String, Schema.Null),
    polarCustomerId: Schema.String,
  }
) {}

/** Converts Polar SDK and thrown errors into readable details. */
function getPolarErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

/** Returns whether a Polar API error means the customer does not exist. */
function isMissingPolarCustomer(error: unknown) {
  return error instanceof PolarError && error.statusCode === 404;
}

/** Returns whether Polar rejected customer creation because the email exists. */
function isDuplicatePolarCustomerEmailError(error: unknown) {
  if (!(error instanceof HTTPValidationError)) {
    return false;
  }

  return (error.detail ?? []).some(
    (detail) =>
      detail.loc.length === 2 &&
      detail.loc[0] === "body" &&
      detail.loc[1] === "email" &&
      detail.msg === "A customer with this email address already exists."
  );
}

/** Extracts only Convex-storable metadata values from Polar metadata. */
function normalizePolarMetadata(metadata: Customer["metadata"]) {
  const entries = Object.entries(metadata ?? {}).filter(
    (entry): entry is [string, string | number | boolean] => {
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

/** Returns whether a customer has already been normalized for local storage. */
function isNormalizedPolarCustomer(
  customer: Customer | NormalizedPolarCustomer
): customer is NormalizedPolarCustomer {
  return !("createdAt" in customer);
}

/** Normalizes Polar customer variants to the fields stored by this backend. */
const normalizeStoredPolarCustomer = Effect.fn("polar.normalizeStoredCustomer")(
  function* (customer: Customer) {
    if (typeof customer.email !== "string") {
      return yield* Effect.fail(
        new PolarCustomerError({
          detail: JSON.stringify({ polarCustomerId: customer.id }),
          message: "Polar customer is missing a valid email address.",
        })
      );
    }

    return {
      email: customer.email,
      externalId: customer.externalId ?? null,
      id: customer.id,
      metadata: normalizePolarMetadata(customer.metadata),
      name: customer.name ?? null,
    };
  }
);

/** Unwraps a Polar SDK result while keeping errors typed. */
const readPolarResult = Effect.fn("polar.readResult")(function* <Value, Error_>(
  result: Result<Value, Error_>,
  message: string
) {
  if (result.ok) {
    return result.value;
  }

  return yield* Effect.fail(
    new PolarCustomerError({
      detail: getPolarErrorMessage(result.error),
      message,
    })
  );
});

/** Finds a Polar customer by email for duplicate-email recovery. */
const findPolarCustomerByEmail = Effect.fn("polar.findCustomerByEmail")(
  function* (email: string) {
    const polarClient = yield* makePolarClient();
    const page = yield* Effect.tryPromise({
      try: () => customersList(polarClient, { email, limit: 1 }),
      catch: (error) =>
        new PolarCustomerError({
          detail: getPolarErrorMessage(error),
          message: "Failed to list Polar customers by email.",
        }),
    });
    const value = yield* readPolarResult(
      page,
      "Failed to list Polar customers by email."
    );
    const customer = value.result.items[0] ?? null;

    if (!customer) {
      return null;
    }

    return yield* normalizeStoredPolarCustomer(customer);
  }
);

/** Updates an existing Polar customer when local identity fields changed. */
const syncExistingCustomer = Effect.fn("polar.syncExistingCustomer")(function* (
  customer: Customer | NormalizedPolarCustomer,
  args: EnsurePolarCustomerArgs
) {
  const normalizedCustomer = isNormalizedPolarCustomer(customer)
    ? customer
    : yield* normalizeStoredPolarCustomer(customer);
  const currentMetadata = JSON.stringify(normalizedCustomer.metadata);
  const nextMetadata = JSON.stringify(args.metadata);

  if (
    normalizedCustomer.externalId &&
    normalizedCustomer.externalId !== args.externalId
  ) {
    return yield* Effect.fail(
      new PolarCustomerEmailConflict({
        existingExternalId: normalizedCustomer.externalId,
        polarCustomerId: normalizedCustomer.id,
      })
    );
  }

  if (
    normalizedCustomer.email === args.email &&
    normalizedCustomer.name === args.name &&
    currentMetadata === nextMetadata &&
    normalizedCustomer.externalId === args.externalId
  ) {
    return normalizedCustomer;
  }

  const polarClient = yield* makePolarClient();
  const updateResult = yield* Effect.tryPromise({
    try: () =>
      customersUpdate(polarClient, {
        customerUpdate: {
          email: args.email,
          externalId: args.externalId,
          metadata: args.metadata,
          name: args.name,
        },
        id: normalizedCustomer.id,
      }),
    catch: (error) =>
      new PolarCustomerError({
        detail: getPolarErrorMessage(error),
        message: "Failed to sync customer data in Polar.",
      }),
  });
  const updatedCustomer = yield* readPolarResult(
    updateResult,
    "Failed to sync customer data in Polar."
  );

  return yield* normalizeStoredPolarCustomer(updatedCustomer);
});

/** Ensures Polar has a customer matching the local app user identity. */
export const ensurePolarCustomer = Effect.fn("polar.ensureCustomer")(function* (
  args: EnsurePolarCustomerArgs
) {
  const polarClient = yield* makePolarClient();

  if (args.localCustomerId) {
    const localCustomerId = args.localCustomerId;
    const localCustomer = yield* Effect.either(
      Effect.tryPromise({
        try: () => customersGet(polarClient, { id: localCustomerId }),
        catch: (error) => error,
      })
    );

    if (
      localCustomer._tag === "Left" &&
      !isMissingPolarCustomer(localCustomer.left)
    ) {
      return yield* Effect.fail(
        new PolarCustomerError({
          detail: getPolarErrorMessage(localCustomer.left),
          message: "Failed to read local Polar customer.",
        })
      );
    }

    if (localCustomer._tag === "Right" && localCustomer.right.ok) {
      return yield* syncExistingCustomer(localCustomer.right.value, args);
    }
  }

  const externalCustomer = yield* Effect.either(
    Effect.tryPromise({
      try: () =>
        customersGetExternal(polarClient, { externalId: args.externalId }),
      catch: (error) => error,
    })
  );

  if (
    externalCustomer._tag === "Left" &&
    !isMissingPolarCustomer(externalCustomer.left)
  ) {
    return yield* Effect.fail(
      new PolarCustomerError({
        detail: getPolarErrorMessage(externalCustomer.left),
        message: "Failed to read external Polar customer.",
      })
    );
  }

  if (externalCustomer._tag === "Right" && externalCustomer.right.ok) {
    return yield* syncExistingCustomer(externalCustomer.right.value, args);
  }

  const createResult = yield* Effect.either(
    Effect.tryPromise({
      try: () =>
        customersCreate(polarClient, {
          email: args.email,
          externalId: args.externalId,
          metadata: args.metadata,
          name: args.name,
        }),
      catch: (error) => error,
    })
  );

  if (createResult._tag === "Right" && createResult.right.ok) {
    return yield* normalizeStoredPolarCustomer(createResult.right.value);
  }

  const createError =
    createResult._tag === "Left" ? createResult.left : createResult.right.error;
  if (isDuplicatePolarCustomerEmailError(createError)) {
    const existingCustomer = yield* findPolarCustomerByEmail(args.email);
    if (existingCustomer) {
      return yield* syncExistingCustomer(existingCustomer, args);
    }
  }

  const retryResult = yield* Effect.either(
    Effect.tryPromise({
      try: () =>
        customersGetExternal(polarClient, { externalId: args.externalId }),
      catch: (error) => error,
    })
  );

  if (
    retryResult._tag === "Left" &&
    !isMissingPolarCustomer(retryResult.left)
  ) {
    return yield* Effect.fail(
      new PolarCustomerError({
        detail: getPolarErrorMessage(retryResult.left),
        message: "Failed to retry Polar customer lookup.",
      })
    );
  }

  if (retryResult._tag === "Right" && retryResult.right.ok) {
    return yield* syncExistingCustomer(retryResult.right.value, args);
  }

  return yield* Effect.fail(
    new PolarCustomerError({
      detail: getPolarErrorMessage(createError),
      message: "Failed to ensure customer in Polar.",
    })
  );
});

/** Updates only the metadata for a Polar customer. */
export const updatePolarCustomerMetadata = Effect.fn(
  "polar.updateCustomerMetadata"
)(function* (args: { id: string; metadata: PolarMetadata }) {
  const polarClient = yield* makePolarClient();
  const result = yield* Effect.tryPromise({
    try: () =>
      customersUpdate(polarClient, {
        customerUpdate: { metadata: args.metadata },
        id: args.id,
      }),
    catch: (error) =>
      new PolarCustomerError({
        detail: getPolarErrorMessage(error),
        message: "Failed to update customer metadata.",
      }),
  });
  const customer = yield* readPolarResult(
    result,
    "Failed to update customer metadata."
  );

  return yield* normalizeStoredPolarCustomer(customer);
});

/** Creates a Polar checkout session and returns the hosted checkout URL. */
export const createPolarCheckoutSession = Effect.fn(
  "polar.createCheckoutSession"
)(function* (args: {
  customerId: string;
  productIds: readonly string[];
  subscriptionId?: string;
  successUrl: string;
}) {
  const polarClient = yield* makePolarClient();
  const result = yield* Effect.tryPromise({
    try: () =>
      checkoutsCreate(polarClient, {
        allowDiscountCodes: true,
        customerId: args.customerId,
        products: [...args.productIds],
        successUrl: args.successUrl,
        subscriptionId: args.subscriptionId,
      }),
    catch: (error) =>
      new PolarCustomerError({
        detail: getPolarErrorMessage(error),
        message: "Failed to create checkout session.",
      }),
  });
  const checkout = yield* readPolarResult(
    result,
    "Failed to create checkout session."
  );

  return { url: checkout.url };
});

/** Creates a Polar customer portal session and returns the hosted portal URL. */
export const createPolarCustomerPortalSession = Effect.fn(
  "polar.createCustomerPortalSession"
)(function* (args: { customerId: string }) {
  const polarClient = yield* makePolarClient();
  const result = yield* Effect.tryPromise({
    try: () =>
      customerSessionsCreate(polarClient, { customerId: args.customerId }),
    catch: (error) =>
      new PolarCustomerError({
        detail: getPolarErrorMessage(error),
        message: "Failed to create customer portal session.",
      }),
  });
  const session = yield* readPolarResult(
    result,
    "Failed to create customer portal session."
  );

  return { url: session.customerPortalUrl };
});

/** Deletes a Polar customer, ignoring customers already missing from Polar. */
export const deletePolarCustomer = Effect.fn("polar.deleteCustomer")(function* (
  id: string
) {
  const polarClient = yield* makePolarClient();
  const result = yield* Effect.tryPromise({
    try: () => customersDelete(polarClient, { anonymize: true, id }),
    catch: (error) =>
      new PolarCustomerError({
        detail: getPolarErrorMessage(error),
        message: "Failed to delete customer from Polar.",
      }),
  });

  if (!result.ok && isMissingPolarCustomer(result.error)) {
    return null;
  }

  yield* readPolarResult(result, "Failed to delete customer from Polar.");
  return null;
});
