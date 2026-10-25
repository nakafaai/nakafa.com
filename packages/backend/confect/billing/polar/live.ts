import { PolarClientError } from "@polar-sh/sdk";
import { errors, type PolarCore } from "@polar-sh/sdk/2026-10";
import { createCheckoutsService } from "@polar-sh/sdk/2026-10/services/checkouts";
import { createCustomerSessionsService } from "@polar-sh/sdk/2026-10/services/customer_sessions";
import { createCustomersService } from "@polar-sh/sdk/2026-10/services/customers";
import { createRefundsService } from "@polar-sh/sdk/2026-10/services/refunds";
import { createSubscriptionsService } from "@polar-sh/sdk/2026-10/services/subscriptions";
import { readPolarClient } from "@repo/backend/confect/billing/polar/client";
import {
  decodePolarCheckout,
  decodePolarCustomer,
  decodePolarCustomerSession,
  type PolarPayloadError,
} from "@repo/backend/confect/billing/polar/payload";
import {
  PolarCheckoutError,
  type PolarCheckoutInput,
  PolarCustomerError,
  type PolarCustomerIdentity,
  PolarDeleteError,
  PolarDuplicateEmailError,
  PolarPortalError,
  PolarRefundError,
  PolarSubscriptionListError,
  PolarUpdateError,
  polarCheckoutErrorCode,
  polarCustomerErrorCode,
  polarDeleteErrorCode,
  polarDuplicateEmailCode,
  polarPortalErrorCode,
  polarRefundErrorCode,
  polarSubscriptionListErrorCode,
  polarUpdateErrorCode,
} from "@repo/backend/confect/billing/polar/spec";
import { Array as Arr, Data, Effect } from "effect";

/**
 * The subscription statuses reconciliation lists: the ones that hold access or owe
 * a payment. A subscription that ended keeps no grant to reconcile.
 */
const RECONCILED_SUBSCRIPTION_STATUSES = [
  "active",
  "trialing",
  "past_due",
  "unpaid",
] as const;

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

/**
 * The live Polar operations, each with its own failure mapping. The billing model
 * calls them from actions only, because each one is a network request.
 */
export const polarGateway = {
  createCheckoutSession: Effect.fn("polar.createCheckoutSession")(function* (
    input: PolarCheckoutInput
  ) {
    return yield* request(
      (client) =>
        createCheckoutsService(client).create({
          // Learners may apply discount codes at checkout.
          allow_discount_codes: true,
          // The product's trial period, when it has one, applies at checkout.
          allow_trial: true,
          customer_id: input.customerId,
          customer_ip_address: input.customerIpAddress,
          // Checkout is for individuals, so the billing name and address are not required.
          is_business_customer: false,
          locale: input.locale,
          products: [...input.productIds],
          // Only the country is required at checkout; US customers still enter the full address.
          require_billing_address: false,
          success_url: input.successUrl,
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
    input: PolarCustomerIdentity
  ) {
    return yield* request(
      (client) =>
        createCustomersService(client).create({
          email: input.email,
          external_id: input.externalId,
          name: input.name,
          // Polar leaves the type optional, so Nakafa always states individual.
          type: "individual",
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
  /** Deletes the customer and anonymizes its personal data. A customer Polar no longer has counts as deleted. */
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
  /** The customer Polar holds for a Nakafa user ID, or none when Polar holds none. */
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
  /** The customer Polar holds under its own ID, or none when Polar holds none. */
  getCustomer: Effect.fn("polar.getCustomer")(function* (customerId: string) {
    return yield* request(
      (client) => createCustomersService(client).get(customerId),
      decodePolarCustomer
    ).pipe(
      Effect.catchTag("PolarRequestError", ({ cause }) =>
        isMissingCustomer(cause)
          ? Effect.succeed(null)
          : Effect.fail(
              new PolarCustomerError({
                code: polarCustomerErrorCode,
                cause,
                message: "Failed to load Polar customer.",
              })
            )
      )
    );
  }),
  /** One page of the subscriptions that hold access or owe a payment, with the last page Polar lists. */
  listSubscriptions: Effect.fn("polar.listSubscriptions")(function* (
    page: number,
    limit: number
  ) {
    const response = yield* call((client) =>
      createSubscriptionsService(client).list({
        limit,
        page,
        status: [...RECONCILED_SUBSCRIPTION_STATUSES],
      })
    ).pipe(
      Effect.mapError(
        ({ cause }) =>
          new PolarSubscriptionListError({
            code: polarSubscriptionListErrorCode,
            cause,
            message: "Failed to list Polar subscriptions.",
          })
      )
    );
    return { items: response.items, maxPage: response.pagination.max_page };
  }),
  /**
   * Refunds the order's net amount, before taxes, and Polar refunds the tax on it.
   * Polar reports the refund as `order.refunded`, which settles the payment.
   */
  refundOrder: Effect.fn("polar.refundOrder")(function* (input: {
    readonly orderId: string;
    readonly refundableAmount: number;
  }) {
    yield* call((client) =>
      createRefundsService(client).create({
        amount: input.refundableAmount,
        comment: "Top-up paid without an active Pro grant.",
        order_id: input.orderId,
        reason: "other",
      })
    ).pipe(
      Effect.mapError(
        ({ cause }) =>
          new PolarRefundError({
            code: polarRefundErrorCode,
            cause,
            message: "Failed to refund order in Polar.",
          })
      ),
      Effect.asVoid
    );
  }),
  updateCustomer: Effect.fn("polar.updateCustomer")(function* (input: {
    readonly customerId: string;
    readonly identity: PolarCustomerIdentity;
  }) {
    return yield* request(
      (client) =>
        createCustomersService(client).update(input.customerId, {
          email: input.identity.email,
          external_id: input.identity.externalId,
          name: input.identity.name,
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
};
