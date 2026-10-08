import { polarMetadataValidator } from "@repo/backend/confect/customers/schema";
import { Array as Arr, Effect, Schema, Struct } from "effect";

/** A Polar response or webhook payload that does not match the contract its handler reads. */
export class PolarPayloadError extends Schema.TaggedError<PolarPayloadError>()(
  "PolarPayloadError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

/** The customer fields the handlers read, under the names the domain uses. */
const polarCustomerHandledFields = {
  externalId: Schema.optionalKey(Schema.NullOr(Schema.String)),
  id: Schema.String,
  metadata: polarMetadataValidator,
  name: Schema.NullOr(Schema.String),
};

/** The one renamed handled field: the domain reads `externalId`, Polar sends `external_id`. */
const polarCustomerWireNames = { externalId: "external_id" } as const;

/**
 * The customer the handlers read. The `type` field picks the email rule and is
 * dropped after the check, so the domain shape carries no Polar type. Fields the
 * handlers do not read are not checked.
 */
const polarCustomerValidator = Schema.Union([
  Schema.Struct({
    ...polarCustomerHandledFields,
    email: Schema.String,
    type: Schema.Literal("individual"),
  }).pipe(Schema.encodeKeys(polarCustomerWireNames)),
  Schema.Struct({
    ...polarCustomerHandledFields,
    email: Schema.optionalKey(Schema.NullOr(Schema.String)),
    type: Schema.Literal("team"),
  }).pipe(Schema.encodeKeys(polarCustomerWireNames)),
]);

/** The customer the handlers read, as the domain holds it: Polar's type has been checked and dropped. */
export type PolarCustomerSource = Omit<
  typeof polarCustomerValidator.Type,
  "type"
>;

/** One page of customers; the handlers read its first item. */
const polarCustomerPageValidator = Schema.Struct({
  items: Schema.Array(polarCustomerValidator),
});

/**
 * The one customer field a deletion reads. A deletion checks no other field, so
 * an unrelated field cannot fail the request and leave a deleted customer's data
 * in place.
 */
const polarCustomerIdValidator = Schema.Struct({
  id: Schema.String,
});

/**
 * The subscription fields the webhook handlers store. Polar's date-times decode
 * to Date values with `Schema.DateFromString`, and the converter writes each back
 * with `toISOString()`, the form the tryout access query compares. Polar signs its
 * webhooks, so Nakafa does not check the calendar beyond what Date parsing
 * accepts. Recurring intervals and statuses stay open strings because Polar may
 * send values this repository does not store; the converter maps unknown
 * intervals to null. The amount must be a whole number, and the converter stores
 * it as sent.
 */
const polarSubscriptionValidator = Schema.Struct({
  amount: Schema.Int,
  cancelAtPeriodEnd: Schema.Boolean,
  checkoutId: Schema.NullOr(Schema.String),
  createdAt: Schema.DateFromString,
  currency: Schema.String,
  currentPeriodEnd: Schema.DateFromString,
  currentPeriodStart: Schema.DateFromString,
  customerCancellationComment: Schema.NullOr(Schema.String),
  customerCancellationReason: Schema.NullOr(Schema.String),
  customerId: Schema.String,
  endedAt: Schema.NullOr(Schema.DateFromString),
  id: Schema.String,
  metadata: polarMetadataValidator,
  modifiedAt: Schema.NullOr(Schema.DateFromString),
  productId: Schema.String,
  recurringInterval: Schema.String,
  startedAt: Schema.NullOr(Schema.DateFromString),
  status: Schema.String,
}).pipe(
  Schema.encodeKeys({
    cancelAtPeriodEnd: "cancel_at_period_end",
    checkoutId: "checkout_id",
    createdAt: "created_at",
    currentPeriodEnd: "current_period_end",
    currentPeriodStart: "current_period_start",
    customerCancellationComment: "customer_cancellation_comment",
    customerCancellationReason: "customer_cancellation_reason",
    customerId: "customer_id",
    endedAt: "ended_at",
    modifiedAt: "modified_at",
    productId: "product_id",
    recurringInterval: "recurring_interval",
    startedAt: "started_at",
  })
);
export type PolarSubscriptionSource = typeof polarSubscriptionValidator.Type;

/** The hosted checkout URL the learner is sent to. */
const polarCheckoutValidator = Schema.Struct({
  url: Schema.String,
});

/** The customer portal URL the learner opens to manage billing. */
const polarCustomerSessionValidator = Schema.Struct({
  url: Schema.String,
}).pipe(Schema.encodeKeys({ url: "customer_portal_url" }));

/** Names the payload that broke its contract, for logs and the typed failure. */
function payloadFailure(resource: string) {
  return (cause: unknown) =>
    new PolarPayloadError({
      cause,
      message: `Polar ${resource} payload does not match its contract.`,
    });
}

/** Drops Polar's `type` once the email rule has run, so the domain customer carries no Polar type. */
function withoutPolarType<Customer extends { readonly type: string }>(
  customer: Customer
) {
  return Struct.omit(customer, ["type"]);
}

/**
 * Decodes one customer from a Polar response or a customer create or update
 * webhook. Only the fields the handlers read are checked.
 */
export const decodePolarCustomer = Effect.fn("customers.polar.decodeCustomer")(
  (input: unknown) =>
    Schema.decodeUnknownEffect(polarCustomerValidator)(input).pipe(
      Effect.map((customer) => withoutPolarType(customer)),
      Effect.mapError(payloadFailure("customer"))
    )
);

/** Decodes the customer id from a customer deletion. The handler reads no other field. */
export const decodePolarCustomerId = Effect.fn(
  "customers.polar.decodeCustomerId"
)((input: unknown) =>
  Schema.decodeUnknownEffect(polarCustomerIdValidator)(input).pipe(
    Effect.mapError(payloadFailure("customer"))
  )
);

/** Decodes a customer list response. */
export const decodePolarCustomerPage = Effect.fn(
  "customers.polar.decodeCustomerPage"
)((input: unknown) =>
  Schema.decodeUnknownEffect(polarCustomerPageValidator)(input).pipe(
    Effect.map((page) => ({
      items: Arr.map(page.items, (customer) => withoutPolarType(customer)),
    })),
    Effect.mapError(payloadFailure("customer list"))
  )
);

/** Decodes a checkout response into the URL the learner is sent to. */
export const decodePolarCheckout = Effect.fn("customers.polar.decodeCheckout")(
  (input: unknown) =>
    Schema.decodeUnknownEffect(polarCheckoutValidator)(input).pipe(
      Effect.mapError(payloadFailure("checkout"))
    )
);

/** Decodes a customer session response into the customer portal URL. */
export const decodePolarCustomerSession = Effect.fn(
  "customers.polar.decodeCustomerSession"
)((input: unknown) =>
  Schema.decodeUnknownEffect(polarCustomerSessionValidator)(input).pipe(
    Effect.mapError(payloadFailure("customer session"))
  )
);

/** Decodes one subscription from a subscription webhook. */
export const decodePolarSubscription = Effect.fn(
  "customers.polar.decodeSubscription"
)((input: unknown) =>
  Schema.decodeUnknownEffect(polarSubscriptionValidator)(input).pipe(
    Effect.mapError(payloadFailure("subscription"))
  )
);
