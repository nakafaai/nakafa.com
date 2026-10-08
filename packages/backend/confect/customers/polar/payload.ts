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

const leapDay = String.raw`(?:\d\d[2468][048]|\d\d[13579][26]|\d\d0[48]|[02468][048]00|[13579][26]00)-02-29`;
const calendarDate = String.raw`(?:${leapDay}|\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\d|30)|02-(?:0[1-9]|1\d|2[0-8])))`;
const clockTime = String.raw`(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?`;
const zoneOffset = String.raw`Z|[+-](?:[01]\d|2[0-3]):[0-5]\d`;

/**
 * A date-time with a zone offset: the form Polar sends and 0.49 accepted for
 * every date-time (`z.iso.datetime({ offset: true })`). Date parsing alone also
 * accepts February 31, hour 24, and a time without seconds, so the pattern runs
 * before the string is read as a Date.
 */
const polarDateTime = Schema.String.check(
  Schema.isPattern(
    new RegExp(`^${calendarDate}T${clockTime}(?:${zoneOffset})$`)
  )
);

/** A stored date-time, decoded to a Date that the converter writes back with `toISOString()`. */
const polarDate = polarDateTime.pipe(Schema.decodeTo(Schema.DateFromString));

/** A billing address as 0.49 validated it: the country is required and the other fields may be absent. */
const polarAddress = Schema.Struct({
  city: Schema.optionalKey(Schema.NullOr(Schema.String)),
  country: Schema.String,
  line1: Schema.optionalKey(Schema.NullOr(Schema.String)),
  line2: Schema.optionalKey(Schema.NullOr(Schema.String)),
  postal_code: Schema.optionalKey(Schema.NullOr(Schema.String)),
  state: Schema.optionalKey(Schema.NullOr(Schema.String)),
});

/**
 * Every customer field 0.49 validated, under Polar's snake_case names. A customer
 * deletion checks all of them, so a malformed deletion keeps its 400.
 */
const polarCustomerRecordFields = {
  avatar_url: Schema.NullOr(Schema.String),
  billing_address: Schema.NullOr(polarAddress),
  billing_name: Schema.NullOr(Schema.String),
  created_at: polarDateTime,
  default_payment_method_id: Schema.optionalKey(Schema.NullOr(Schema.String)),
  deleted_at: Schema.NullOr(polarDateTime),
  email_verified: Schema.Boolean,
  external_id: Schema.optionalKey(Schema.NullOr(Schema.String)),
  id: Schema.String,
  locale: Schema.optionalKey(Schema.NullOr(Schema.String)),
  metadata: polarMetadataValidator,
  modified_at: Schema.NullOr(polarDateTime),
  name: Schema.NullOr(Schema.String),
  organization_id: Schema.String,
  tax_id: Schema.NullOr(Schema.Array(Schema.NullOr(Schema.String))),
};

/**
 * A whole Polar customer, discriminated by `type`. An individual always carries a
 * string email; a team may carry none, and the customer normalizer decides that case.
 */
const polarCustomerRecordValidator = Schema.Union([
  Schema.Struct({
    ...polarCustomerRecordFields,
    email: Schema.String,
    type: Schema.Literal("individual"),
  }),
  Schema.Struct({
    ...polarCustomerRecordFields,
    email: Schema.optionalKey(Schema.NullOr(Schema.String)),
    type: Schema.Literal("team"),
  }),
]);

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
 * The subscription fields the webhook handlers store. Polar's date-times decode
 * to Date values, and the converter writes each back with `toISOString()`, the
 * form the tryout access query compares. Recurring intervals and statuses stay
 * open strings because Polar may send values this repository does not store;
 * the converter maps unknown intervals to null. The amount must be an integer,
 * as 0.49 required.
 */
const polarSubscriptionValidator = Schema.Struct({
  amount: Schema.Int,
  cancelAtPeriodEnd: Schema.Boolean,
  checkoutId: Schema.NullOr(Schema.String),
  createdAt: polarDate,
  currency: Schema.String,
  currentPeriodEnd: polarDate,
  currentPeriodStart: polarDate,
  customerCancellationComment: Schema.NullOr(Schema.String),
  customerCancellationReason: Schema.NullOr(Schema.String),
  customerId: Schema.String,
  endedAt: Schema.NullOr(polarDate),
  id: Schema.String,
  metadata: polarMetadataValidator,
  modifiedAt: Schema.NullOr(polarDate),
  productId: Schema.String,
  recurringInterval: Schema.String,
  startedAt: Schema.NullOr(polarDate),
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

/** Decodes a whole customer from a customer deletion, checking every field 0.49 checked. */
export const decodePolarCustomerRecord = Effect.fn(
  "customers.polar.decodeCustomerRecord"
)((input: unknown) =>
  Schema.decodeUnknownEffect(polarCustomerRecordValidator)(input).pipe(
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
