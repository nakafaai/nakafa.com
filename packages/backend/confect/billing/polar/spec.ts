import { polarCheckoutLocaleValidator } from "@repo/backend/confect/billing/locale";
import { publicFailure } from "@repo/backend/confect/failure";
import { Schema } from "effect";

/** A Polar customer that Nakafa holds no account for. The caller links it to a user, then applies the event again. */
const PolarUnknownCustomer = Schema.Struct({
  kind: Schema.Literal("unknownCustomer"),
  customerId: Schema.String,
});

/** What applying one Polar subscription did. Only an unknown customer is a value; the rest are outcomes. */
export const PolarSubscriptionOutcome = Schema.Union([
  Schema.Literals(["applied", "invalid", "stale", "unsupported"]),
  PolarUnknownCustomer,
]);
export type PolarSubscriptionOutcome = typeof PolarSubscriptionOutcome.Type;

export const polarCheckoutErrorCode = "POLAR_CHECKOUT_ERROR";
export const polarCustomerErrorCode = "POLAR_CUSTOMER_ERROR";
export const polarDeleteErrorCode = "POLAR_DELETE_ERROR";
export const polarDuplicateEmailCode = "POLAR_DUPLICATE_EMAIL";
export const polarPortalErrorCode = "POLAR_PORTAL_ERROR";
export const polarRefundErrorCode = "POLAR_REFUND_ERROR";
export const polarUpdateErrorCode = "POLAR_UPDATE_ERROR";
export const polarSubscriptionListErrorCode = "POLAR_SUBSCRIPTION_LIST_ERROR";

/** The checkout a Polar customer starts: the customer, the products, and where the learner returns. */
const polarCheckoutInputValidator = Schema.Struct({
  customerId: Schema.String,
  customerIpAddress: Schema.NullOr(Schema.String),
  locale: polarCheckoutLocaleValidator,
  productIds: Schema.Array(Schema.String),
  successUrl: Schema.String,
});
export type PolarCheckoutInput = typeof polarCheckoutInputValidator.Type;

/** The identity Nakafa keeps in step with a Polar customer: the external ID is the Nakafa user ID. */
const polarCustomerIdentityValidator = Schema.Struct({
  email: Schema.String,
  externalId: Schema.String,
  name: Schema.String,
});
export type PolarCustomerIdentity = typeof polarCustomerIdentityValidator.Type;

export class PolarCheckoutError extends Schema.TaggedError<PolarCheckoutError>()(
  "PolarCheckoutError",
  {
    code: Schema.Literal(polarCheckoutErrorCode),
    cause: Schema.optional(Schema.Unknown),
    message: Schema.String,
  }
) {
  declare readonly code: typeof polarCheckoutErrorCode;
  declare readonly message: string;
}
export const PolarCheckoutErrorWire = publicFailure(PolarCheckoutError);

export class PolarCustomerError extends Schema.TaggedError<PolarCustomerError>()(
  "PolarCustomerError",
  {
    code: Schema.Literal(polarCustomerErrorCode),
    cause: Schema.optional(Schema.Unknown),
    message: Schema.String,
  }
) {
  declare readonly code: typeof polarCustomerErrorCode;
  declare readonly message: string;
}
export const PolarCustomerErrorWire = publicFailure(PolarCustomerError);

export class PolarDeleteError extends Schema.TaggedError<PolarDeleteError>()(
  "PolarDeleteError",
  {
    code: Schema.Literal(polarDeleteErrorCode),
    cause: Schema.optional(Schema.Unknown),
    message: Schema.String,
  }
) {
  declare readonly code: typeof polarDeleteErrorCode;
  declare readonly message: string;
}
export const PolarDeleteErrorWire = publicFailure(PolarDeleteError);

export class PolarDuplicateEmailError extends Schema.TaggedError<PolarDuplicateEmailError>()(
  "PolarDuplicateEmailError",
  {
    code: Schema.Literal(polarDuplicateEmailCode),
    cause: Schema.optional(Schema.Unknown),
    message: Schema.String,
  }
) {
  declare readonly code: typeof polarDuplicateEmailCode;
  declare readonly message: string;
}
export const PolarDuplicateEmailErrorWire = publicFailure(
  PolarDuplicateEmailError
);

export class PolarPortalError extends Schema.TaggedError<PolarPortalError>()(
  "PolarPortalError",
  {
    code: Schema.Literal(polarPortalErrorCode),
    cause: Schema.optional(Schema.Unknown),
    message: Schema.String,
  }
) {
  declare readonly code: typeof polarPortalErrorCode;
  declare readonly message: string;
}
export const PolarPortalErrorWire = publicFailure(PolarPortalError);

export class PolarRefundError extends Schema.TaggedError<PolarRefundError>()(
  "PolarRefundError",
  {
    code: Schema.Literal(polarRefundErrorCode),
    cause: Schema.optional(Schema.Unknown),
    message: Schema.String,
  }
) {
  declare readonly code: typeof polarRefundErrorCode;
  declare readonly message: string;
}
export const PolarRefundErrorWire = publicFailure(PolarRefundError);

export class PolarUpdateError extends Schema.TaggedError<PolarUpdateError>()(
  "PolarUpdateError",
  {
    code: Schema.Literal(polarUpdateErrorCode),
    cause: Schema.optional(Schema.Unknown),
    message: Schema.String,
  }
) {
  declare readonly code: typeof polarUpdateErrorCode;
  declare readonly message: string;
}
export const PolarUpdateErrorWire = publicFailure(PolarUpdateError);

export class PolarSubscriptionListError extends Schema.TaggedError<PolarSubscriptionListError>()(
  "PolarSubscriptionListError",
  {
    code: Schema.Literal(polarSubscriptionListErrorCode),
    cause: Schema.optional(Schema.Unknown),
    message: Schema.String,
  }
) {
  declare readonly code: typeof polarSubscriptionListErrorCode;
  declare readonly message: string;
}
export const PolarSubscriptionListErrorWire = publicFailure(
  PolarSubscriptionListError
);
