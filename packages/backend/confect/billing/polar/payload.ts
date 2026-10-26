import { BillingCountry } from "@repo/backend/confect/billing/schema";
import { Effect, Schema } from "effect";

/** A Polar response or webhook payload that does not match the contract its handler reads. */
export class PolarPayloadError extends Schema.TaggedError<PolarPayloadError>()(
  "PolarPayloadError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

/**
 * The customer fields Nakafa reads. Polar's type picks the email rule and is dropped after the check.
 * A missing email, external ID, name, or billing country reads as null.
 */
const polarCustomerValidator = Schema.Struct({
  billingAddress: Schema.optionalKey(
    Schema.NullOr(
      Schema.Struct({
        country: Schema.optionalKey(Schema.NullOr(BillingCountry)),
      })
    )
  ),
  email: Schema.optionalKey(Schema.NullOr(Schema.String)),
  externalId: Schema.optionalKey(Schema.NullOr(Schema.String)),
  id: Schema.String,
  name: Schema.optionalKey(Schema.NullOr(Schema.String)),
  type: Schema.Literals(["individual", "team"]),
}).pipe(
  Schema.encodeKeys({
    billingAddress: "billing_address",
    externalId: "external_id",
  })
);

/** The hosted checkout URL the learner is sent to. */
const polarCheckoutValidator = Schema.Struct({
  url: Schema.String,
});

/** The customer portal URL the learner opens to manage billing. */
const polarCustomerSessionValidator = Schema.Struct({
  url: Schema.String,
}).pipe(Schema.encodeKeys({ url: "customer_portal_url" }));

/**
 * The subscription fields the webhook handler reads. Polar's date-times decode to
 * Date values, so the billing model stores each as epoch milliseconds. Recurring
 * intervals and statuses stay open strings, because Polar may send values Nakafa
 * does not sell; the state mapping decides what they mean. `pastDueAt` is the time
 * a renewal payment failed, and Polar sends it only while a subscription is past due.
 */
const polarSubscriptionValidator = Schema.Struct({
  cancelAtPeriodEnd: Schema.Boolean,
  createdAt: Schema.DateFromString,
  currentPeriodEnd: Schema.NullOr(Schema.DateFromString),
  currentPeriodStart: Schema.DateFromString,
  customerId: Schema.String,
  endedAt: Schema.NullOr(Schema.DateFromString),
  id: Schema.String,
  /** The keys the checkout set. A School seat subscription names the school it pays for as `tenantId`. */
  metadata: Schema.optionalKey(Schema.Record(Schema.String, Schema.Unknown)),
  modifiedAt: Schema.NullOr(Schema.DateFromString),
  pastDueAt: Schema.optionalKey(Schema.NullOr(Schema.DateFromString)),
  priceId: Schema.optionalKey(Schema.NullOr(Schema.String)),
  productId: Schema.String,
  recurringInterval: Schema.NullOr(Schema.String),
  /** The seats a seat-based subscription bills, and nothing for any other product. */
  seats: Schema.optionalKey(Schema.NullOr(Schema.Int)),
  status: Schema.String,
}).pipe(
  Schema.encodeKeys({
    cancelAtPeriodEnd: "cancel_at_period_end",
    createdAt: "created_at",
    currentPeriodEnd: "current_period_end",
    currentPeriodStart: "current_period_start",
    customerId: "customer_id",
    endedAt: "ended_at",
    modifiedAt: "modified_at",
    pastDueAt: "past_due_at",
    priceId: "price_id",
    productId: "product_id",
    recurringInterval: "recurring_interval",
  })
);
export type PolarSubscriptionSource = typeof polarSubscriptionValidator.Type;

/**
 * The order fields the top-up handler reads. An order's amount is in the
 * currency's minor unit. `refundableAmount` is what a refund may take: the net
 * amount before taxes, which Polar refunds the tax on. `subscriptionId` names the
 * subscription a recurring order renews, and it is null for a one-time order such
 * as a top-up pack.
 */
const polarOrderValidator = Schema.Struct({
  createdAt: Schema.DateFromString,
  currency: Schema.String,
  customerId: Schema.String,
  id: Schema.String,
  modifiedAt: Schema.NullOr(Schema.DateFromString),
  paid: Schema.Boolean,
  productId: Schema.NullOr(Schema.String),
  refundableAmount: Schema.Int,
  refundedAmount: Schema.Int,
  subscriptionId: Schema.NullOr(Schema.String),
  totalAmount: Schema.Int,
}).pipe(
  Schema.encodeKeys({
    createdAt: "created_at",
    customerId: "customer_id",
    modifiedAt: "modified_at",
    productId: "product_id",
    refundableAmount: "refundable_amount",
    refundedAmount: "refunded_amount",
    subscriptionId: "subscription_id",
    totalAmount: "total_amount",
  })
);

/** The envelope of every Polar webhook. The handler decodes `data` by the type it names. */
const polarEnvelopeValidator = Schema.Struct({
  data: Schema.Unknown,
  type: Schema.String,
});
/** Reads the event type and its raw data from one stored webhook body, or none when the body is not an event. */
export const decodePolarEnvelope = Schema.decodeUnknownOption(
  Schema.fromJsonString(polarEnvelopeValidator)
);

/** Names the payload that broke its contract, for logs and the typed failure. */
function payloadFailure(resource: string) {
  return (cause: unknown) =>
    new PolarPayloadError({
      cause,
      message: `Polar ${resource} payload does not match its contract.`,
    });
}

/** Decodes one customer from a Polar customer response, with the billing country Polar holds for it. */
export const decodePolarCustomer = Effect.fn("billing.polar.decodeCustomer")(
  (input: unknown) =>
    Schema.decodeUnknownEffect(polarCustomerValidator)(input).pipe(
      Effect.map((customer) => ({
        billingCountry: customer.billingAddress?.country ?? null,
        email: customer.email ?? null,
        externalId: customer.externalId ?? null,
        id: customer.id,
        name: customer.name ?? null,
      })),
      Effect.mapError(payloadFailure("customer"))
    )
);

/** Decodes a checkout response into the URL the learner is sent to. */
export const decodePolarCheckout = Effect.fn("billing.polar.decodeCheckout")(
  (input: unknown) =>
    Schema.decodeUnknownEffect(polarCheckoutValidator)(input).pipe(
      Effect.mapError(payloadFailure("checkout"))
    )
);

/** Decodes a customer session response into the customer portal URL. */
export const decodePolarCustomerSession = Effect.fn(
  "billing.polar.decodeCustomerSession"
)((input: unknown) =>
  Schema.decodeUnknownEffect(polarCustomerSessionValidator)(input).pipe(
    Effect.mapError(payloadFailure("customer session"))
  )
);

/** Decodes one subscription from a subscription webhook's `data`, or from a subscription listed for reconciliation. */
export const decodePolarSubscription = Effect.fn(
  "billing.polar.decodeSubscription"
)((input: unknown) =>
  Schema.decodeUnknownEffect(polarSubscriptionValidator)(input).pipe(
    Effect.mapError(payloadFailure("subscription"))
  )
);

/** Decodes one order from an order webhook's `data`. */
export const decodePolarOrder = Effect.fn("billing.polar.decodeOrder")(
  (input: unknown) =>
    Schema.decodeUnknownEffect(polarOrderValidator)(input).pipe(
      Effect.mapError(payloadFailure("order"))
    )
);
