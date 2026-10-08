import { PolarClientError } from "@polar-sh/sdk";
import { errors, type PolarCore } from "@polar-sh/sdk/2026-10";
import { createCheckoutsService } from "@polar-sh/sdk/2026-10/services/checkouts";
import { createCustomerSessionsService } from "@polar-sh/sdk/2026-10/services/customer_sessions";
import { createCustomersService } from "@polar-sh/sdk/2026-10/services/customers";
import { readPolarClient } from "@repo/backend/confect/customers/polar/client";
import {
  decodePolarCheckout,
  decodePolarCustomer,
  decodePolarCustomerPage,
  decodePolarCustomerSession,
  type PolarPayloadError,
} from "@repo/backend/confect/customers/polar/payload";
import {
  PolarCheckoutError,
  PolarCustomerError,
  type PolarCustomerGateway,
  PolarDeleteError,
  PolarDuplicateEmailError,
  PolarPortalError,
  PolarUpdateError,
  polarCheckoutErrorCode,
  polarCustomerErrorCode,
  polarDeleteErrorCode,
  polarDuplicateEmailCode,
  polarPortalErrorCode,
  polarUpdateErrorCode,
} from "@repo/backend/confect/customers/polar/spec";
import { Array as Arr, Data, Effect } from "effect";

class PolarRequestError extends Data.TaggedError("PolarRequestError")<{
  readonly cause: unknown;
}> {}

/** Runs one SDK call; a rejected promise and a missing client configuration both fail it. */
const call = Effect.fn("polar.call")(function* <Value>(
  run: (client: PolarCore) => Promise<Value>
) {
  const client = yield* readPolarClient().pipe(
    Effect.mapError((cause) => new PolarRequestError({ cause }))
  );
  return yield* Effect.tryPromise({
    try: () => run(client),
    catch: (cause) => new PolarRequestError({ cause }),
  });
});

/** Runs one SDK call and checks its payload against the contract the handlers read. */
const request = Effect.fn("polar.request")(function* <Value, Decoded>(
  run: (client: PolarCore) => Promise<Value>,
  decode: (payload: Value) => Effect.Effect<Decoded, PolarPayloadError>
) {
  const payload = yield* call(run);
  return yield* decode(payload).pipe(
    Effect.mapError((cause) => new PolarRequestError({ cause }))
  );
});

/** Only a provider 404 means the customer is absent or already deleted. */
function isMissingCustomer(error: unknown) {
  return error instanceof PolarClientError && error.statusCode === 404;
}

/** Matches the exact validation error Polar returns for an email that is already taken. */
function isDuplicateEmail(error: unknown) {
  return (
    error instanceof errors.HTTPValidationError &&
    Arr.some(
      error.error.detail ?? [],
      (detail) =>
        detail.loc.length === 2 &&
        detail.loc[0] === "body" &&
        detail.loc[1] === "email" &&
        detail.msg === "A customer with this email address already exists."
    )
  );
}

/** Live Polar operations keep recovery policy next to each domain operation. */
export const polarGateway: PolarCustomerGateway = {
  createCheckoutSession: Effect.fn("polar.createCheckoutSession")(function* (
    input: Parameters<PolarCustomerGateway["createCheckoutSession"]>[0]
  ) {
    return yield* request(
      (client) =>
        createCheckoutsService(client).create({
          // The checkout body always carries these flags, so they are sent explicitly.
          allow_discount_codes: true,
          allow_trial: true,
          customer_id: input.customerId,
          customer_ip_address: input.customerIpAddress,
          is_business_customer: false,
          locale: input.locale,
          products: input.productIds,
          require_billing_address: false,
          success_url: input.successUrl,
          ...(input.embedOrigin === undefined
            ? {}
            : { embed_origin: input.embedOrigin }),
          ...(input.subscriptionId === undefined
            ? {}
            : { subscription_id: input.subscriptionId }),
        }),
      decodePolarCheckout
    ).pipe(
      Effect.mapError(
        ({ cause }) =>
          new PolarCheckoutError({
            code: polarCheckoutErrorCode,
            cause,
            message: "Failed to create checkout session.",
          })
      )
    );
  }),
  createCustomer: Effect.fn("polar.createCustomer")(function* (
    input: Parameters<PolarCustomerGateway["createCustomer"]>[0]
  ) {
    return yield* request(
      (client) =>
        createCustomersService(client).create({
          // Customers are always created as individuals, so the type is sent explicitly.
          email: input.email,
          external_id: input.externalId,
          name: input.name,
          type: "individual",
          ...(input.metadata === undefined ? {} : { metadata: input.metadata }),
        }),
      decodePolarCustomer
    ).pipe(
      Effect.mapError(({ cause }) =>
        isDuplicateEmail(cause)
          ? new PolarDuplicateEmailError({
              code: polarDuplicateEmailCode,
              cause,
              message:
                "A Polar customer already exists for this email address.",
            })
          : new PolarCustomerError({
              code: polarCustomerErrorCode,
              cause,
              message: "Failed to create Polar customer.",
            })
      )
    );
  }),
  createCustomerPortalSession: Effect.fn("polar.createCustomerPortalSession")(
    function* (customerId: string) {
      return yield* request(
        (client) =>
          createCustomerSessionsService(client).create({
            customer_id: customerId,
          }),
        decodePolarCustomerSession
      ).pipe(
        Effect.mapError(
          ({ cause }) =>
            new PolarPortalError({
              code: polarPortalErrorCode,
              cause,
              message: "Failed to create customer portal session.",
            })
        )
      );
    }
  ),
  deleteCustomer: Effect.fn("polar.deleteCustomer")(function* (id: string) {
    return yield* call((client) =>
      createCustomersService(client).delete(id, { anonymize: true })
    ).pipe(
      Effect.as(null),
      Effect.catchTag("PolarRequestError", ({ cause }) =>
        isMissingCustomer(cause)
          ? Effect.succeed(null)
          : Effect.fail(
              new PolarDeleteError({
                code: polarDeleteErrorCode,
                cause,
                message: "Failed to delete customer from Polar.",
              })
            )
      )
    );
  }),
  findCustomerByEmail: Effect.fn("polar.findCustomerByEmail")(function* (
    email: string
  ) {
    // An empty sort sends no sorting parameter, so the SDK's created-at default does not apply.
    const page = yield* request(
      (client) =>
        createCustomersService(client).list({
          email,
          limit: 1,
          sorting: [],
        }),
      decodePolarCustomerPage
    ).pipe(
      Effect.mapError(
        ({ cause }) =>
          new PolarCustomerError({
            code: polarCustomerErrorCode,
            cause,
            message: "Failed to find Polar customer by email.",
          })
      )
    );
    return page.items[0] ?? null;
  }),
  getCustomerByExternalId: Effect.fn("polar.getCustomerByExternalId")(
    function* (externalId: string) {
      return yield* request(
        (client) => createCustomersService(client).getExternal(externalId),
        decodePolarCustomer
      ).pipe(
        Effect.catchTag("PolarRequestError", ({ cause }) =>
          isMissingCustomer(cause)
            ? Effect.succeed(null)
            : Effect.fail(
                new PolarCustomerError({
                  code: polarCustomerErrorCode,
                  cause,
                  message: "Failed to load Polar customer by external ID.",
                })
              )
        )
      );
    }
  ),
  getCustomerById: Effect.fn("polar.getCustomerById")(function* (id: string) {
    return yield* request(
      (client) => createCustomersService(client).get(id),
      decodePolarCustomer
    ).pipe(
      Effect.catchTag("PolarRequestError", ({ cause }) =>
        isMissingCustomer(cause)
          ? Effect.succeed(null)
          : Effect.fail(
              new PolarCustomerError({
                code: polarCustomerErrorCode,
                cause,
                message: "Failed to load Polar customer by ID.",
              })
            )
      )
    );
  }),
  updateCustomer: Effect.fn("polar.updateCustomer")(function* (
    input: Parameters<PolarCustomerGateway["updateCustomer"]>[0]
  ) {
    return yield* request(
      (client) =>
        createCustomersService(client).update(input.customer.id, {
          email: input.next.email,
          external_id: input.next.externalId,
          name: input.next.name,
          ...(input.next.metadata === undefined
            ? {}
            : { metadata: input.next.metadata }),
        }),
      decodePolarCustomer
    ).pipe(
      Effect.mapError(
        ({ cause }) =>
          new PolarUpdateError({
            code: polarUpdateErrorCode,
            cause,
            message: "Failed to sync customer data in Polar.",
          })
      )
    );
  }),
  updateCustomerMetadata: Effect.fn("polar.updateCustomerMetadata")(function* (
    input: Parameters<PolarCustomerGateway["updateCustomerMetadata"]>[0]
  ) {
    return yield* request(
      (client) =>
        createCustomersService(client).update(input.polarCustomerId, {
          metadata: input.metadata,
        }),
      decodePolarCustomer
    ).pipe(
      Effect.mapError(
        ({ cause }) =>
          new PolarUpdateError({
            code: polarUpdateErrorCode,
            cause,
            message: "Failed to update customer metadata.",
          })
      )
    );
  }),
};
