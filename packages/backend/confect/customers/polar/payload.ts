import { polarMetadataValidator } from "@repo/backend/confect/customers/schema";
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
 * The customer fields the billing handlers read, decoded from Polar's snake_case
 * payload. A team customer may carry no email; the customer normalizer decides
 * whether that identity can be linked.
 */
export const polarCustomerValidator = Schema.Struct({
  email: Schema.optionalKey(Schema.NullOr(Schema.String)),
  externalId: Schema.optionalKey(Schema.NullOr(Schema.String)),
  id: Schema.String,
  metadata: polarMetadataValidator,
  name: Schema.NullOr(Schema.String),
}).pipe(Schema.encodeKeys({ externalId: "external_id" }));
export type PolarCustomerSource = typeof polarCustomerValidator.Type;

/** One page of customers; the handlers read its first item. */
export const polarCustomerPageValidator = Schema.Struct({
  items: Schema.Array(polarCustomerValidator),
});

/** The hosted checkout URL the learner is sent to. */
export const polarCheckoutValidator = Schema.Struct({
  url: Schema.String,
});

/** The customer portal URL the learner opens to manage billing. */
export const polarCustomerSessionValidator = Schema.Struct({
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

/** Decodes one customer from a Polar response or a customer webhook. */
export const decodePolarCustomer = Effect.fn("customers.polar.decodeCustomer")(
  (input: unknown) =>
    Schema.decodeUnknownEffect(polarCustomerValidator)(input).pipe(
      Effect.mapError(payloadFailure("customer"))
    )
);

/** Decodes a customer list response. */
export const decodePolarCustomerPage = Effect.fn(
  "customers.polar.decodeCustomerPage"
)((input: unknown) =>
  Schema.decodeUnknownEffect(polarCustomerPageValidator)(input).pipe(
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
