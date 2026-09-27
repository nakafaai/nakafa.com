import type { PolarCore } from "@polar-sh/sdk/core";
import { checkoutsCreate } from "@polar-sh/sdk/funcs/checkoutsCreate";
import { customerSessionsCreate } from "@polar-sh/sdk/funcs/customerSessionsCreate";
import { customersCreate } from "@polar-sh/sdk/funcs/customersCreate";
import { customersDelete } from "@polar-sh/sdk/funcs/customersDelete";
import { customersGet } from "@polar-sh/sdk/funcs/customersGet";
import { customersGetExternal } from "@polar-sh/sdk/funcs/customersGetExternal";
import { customersList } from "@polar-sh/sdk/funcs/customersList";
import { customersUpdate } from "@polar-sh/sdk/funcs/customersUpdate";
import { HTTPValidationError } from "@polar-sh/sdk/models/errors/httpvalidationerror";
import { PolarError } from "@polar-sh/sdk/models/errors/polarerror";
import type { Result } from "@polar-sh/sdk/types/fp";
import { readPolarClient } from "@repo/backend/confect/customers/polar/client";
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
import { Data, Effect } from "effect";

class PolarRequestError extends Data.TaggedError("PolarRequestError")<{
  readonly cause: unknown;
}> {}

/** Normalize the SDK's rejected promises and returned errors at the IO boundary. */
const request = Effect.fn("polar.request")(function* <Value>(
  call: (client: PolarCore) => Promise<Result<Value, unknown>>
) {
  const client = yield* readPolarClient().pipe(
    Effect.mapError((cause) => new PolarRequestError({ cause }))
  );
  const result = yield* Effect.tryPromise({
    try: () => call(client),
    catch: (cause) => new PolarRequestError({ cause }),
  });
  if (!result.ok) {
    return yield* new PolarRequestError({ cause: result.error });
  }
  return result.value;
});

function isMissingCustomer(error: unknown) {
  return error instanceof PolarError && error.statusCode === 404;
}

function isDuplicateEmail(error: unknown) {
  return (
    error instanceof HTTPValidationError &&
    (error.detail ?? []).some(
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
    const checkout = yield* request((client) =>
      checkoutsCreate(client, {
        allowDiscountCodes: true,
        customerId: input.customerId,
        customerIpAddress: input.customerIpAddress,
        locale: input.locale,
        products: input.productIds,
        successUrl: input.successUrl,
        embedOrigin: input.embedOrigin,
        subscriptionId: input.subscriptionId,
      })
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
    return { url: checkout.url };
  }),
  createCustomer: Effect.fn("polar.createCustomer")(function* (
    input: Parameters<PolarCustomerGateway["createCustomer"]>[0]
  ) {
    return yield* request((client) =>
      customersCreate(client, {
        externalId: input.externalId,
        email: input.email,
        name: input.name,
        metadata: input.metadata,
      })
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
      const session = yield* request((client) =>
        customerSessionsCreate(client, { customerId })
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
      return { url: session.customerPortalUrl };
    }
  ),
  deleteCustomer: Effect.fn("polar.deleteCustomer")(function* (id: string) {
    return yield* request((client) =>
      customersDelete(client, { anonymize: true, id })
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
    const page = yield* request((client) =>
      customersList(client, { email, limit: 1 })
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
    return page.result.items[0] ?? null;
  }),
  getCustomerByExternalId: Effect.fn("polar.getCustomerByExternalId")(
    function* (externalId: string) {
      return yield* request((client) =>
        customersGetExternal(client, { externalId })
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
    return yield* request((client) => customersGet(client, { id })).pipe(
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
    return yield* request((client) =>
      customersUpdate(client, {
        id: input.customer.id,
        customerUpdate: {
          email: input.next.email,
          externalId: input.next.externalId,
          metadata: input.next.metadata,
          name: input.next.name,
        },
      })
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
    return yield* request((client) =>
      customersUpdate(client, {
        id: input.polarCustomerId,
        customerUpdate: { metadata: input.metadata },
      })
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
