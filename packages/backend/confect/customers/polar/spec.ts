import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import type { PolarCheckoutLocale } from "@repo/backend/confect/customers/checkout/localization";
import type { polarMetadataValidator } from "@repo/backend/confect/customers/schema";
import { publicFailure } from "@repo/backend/confect/failure";
import type { Effect } from "effect";
import { Schema, Struct } from "effect";
export const polarCheckoutErrorCode = "POLAR_CHECKOUT_ERROR";
export const polarCustomerEmailConflictCode = "POLAR_CUSTOMER_EMAIL_CONFLICT";
export const polarCustomerErrorCode = "POLAR_CUSTOMER_ERROR";
export const polarDeleteErrorCode = "POLAR_DELETE_ERROR";
export const polarDuplicateEmailCode = "POLAR_DUPLICATE_EMAIL";
export const polarPortalErrorCode = "POLAR_PORTAL_ERROR";
export const polarUpdateErrorCode = "POLAR_UPDATE_ERROR";
export const customerIdMetadataKey = "userId";
export const checkoutSessionResultValidator = Schema.Struct({
  url: Schema.String,
});
export type PolarMetadata = Schema.Schema.Type<typeof polarMetadataValidator>;
export type CheckoutSessionResult = Schema.Schema.Type<
  typeof checkoutSessionResultValidator
>;
export interface PolarCustomerSource {
  readonly email?: string | null | undefined;
  readonly externalId?: string | null | undefined;
  readonly id: string;
  readonly metadata?: Record<string, unknown> | null | undefined;
  readonly name?: string | null | undefined;
}
export interface StoredPolarCustomer {
  readonly email: string;
  readonly externalId: string | null;
  readonly id: string;
  readonly metadata: PolarMetadata;
  readonly name: string | null;
}
export interface EnsurePolarCustomerInput {
  readonly email: string;
  readonly externalId: string;
  readonly localCustomerId?: string;
  readonly metadata?: PolarMetadata;
  readonly name: string;
}
export interface PolarCheckoutInput {
  readonly customerId: string;
  readonly customerIpAddress: string | null;
  readonly embedOrigin?: string;
  readonly locale: PolarCheckoutLocale;
  readonly productIds: string[];
  readonly subscriptionId?: string;
  readonly successUrl: string;
}
export interface PolarCustomerGateway {
  readonly createCheckoutSession: (
    input: PolarCheckoutInput
  ) => Effect.Effect<CheckoutSessionResult, PolarCheckoutError>;
  readonly createCustomer: (
    input: EnsurePolarCustomerInput
  ) => Effect.Effect<
    PolarCustomerSource,
    PolarCustomerError | PolarDuplicateEmailError
  >;
  readonly createCustomerPortalSession: (
    customerId: string
  ) => Effect.Effect<CheckoutSessionResult, PolarPortalError>;
  readonly deleteCustomer: (
    polarCustomerId: string
  ) => Effect.Effect<null, PolarDeleteError>;
  readonly findCustomerByEmail: (
    email: string
  ) => Effect.Effect<PolarCustomerSource | null, PolarCustomerError>;
  readonly getCustomerByExternalId: (
    externalId: string
  ) => Effect.Effect<PolarCustomerSource | null, PolarCustomerError>;
  readonly getCustomerById: (
    polarCustomerId: string
  ) => Effect.Effect<PolarCustomerSource | null, PolarCustomerError>;
  readonly updateCustomer: (input: {
    readonly customer: StoredPolarCustomer;
    readonly next: EnsurePolarCustomerInput;
  }) => Effect.Effect<PolarCustomerSource, PolarUpdateError>;
  readonly updateCustomerMetadata: (input: {
    readonly polarCustomerId: string;
    readonly metadata: PolarMetadata;
  }) => Effect.Effect<PolarCustomerSource, PolarUpdateError>;
}
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
export class PolarCustomerEmailConflict extends Schema.TaggedError<PolarCustomerEmailConflict>()(
  "PolarCustomerEmailConflict",
  {
    code: Schema.Literal(polarCustomerEmailConflictCode),
    existingExternalId: Schema.NullOr(Schema.String),
    message: Schema.String,
    polarCustomerId: Schema.String,
  }
) {
  declare readonly code: typeof polarCustomerEmailConflictCode;
  declare readonly existingExternalId: string | null;
  declare readonly message: string;
  declare readonly polarCustomerId: string;
}
/** Public errors omit customer identifiers while retaining their discriminant. */
export const PolarCustomerEmailConflictWire = Schema.Struct(
  Struct.pick(PolarCustomerEmailConflict.fields, ["_tag", "code", "message"])
);
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
export type PolarCustomerErrorUnion =
  | PolarCheckoutError
  | PolarCustomerEmailConflict
  | PolarCustomerError
  | PolarDeleteError
  | PolarPortalError
  | PolarUpdateError;
export const polarCustomerWebhookTargetValidator = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("active"),
    userId: IdSchema("users"),
  }),
  Schema.Struct({
    kind: Schema.Literal("conflict"),
  }),
  Schema.Struct({
    kind: Schema.Literal("deleted"),
  }),
  Schema.Struct({
    kind: Schema.Literal("missing"),
  }),
  Schema.Struct({
    kind: Schema.Literal("prepared"),
  }),
]);
export class PolarCustomerWebhookTargetIoError extends Schema.TaggedError<PolarCustomerWebhookTargetIoError>()(
  "PolarCustomerWebhookTargetIoError",
  {
    code: Schema.Literal("POLAR_CUSTOMER_WEBHOOK_TARGET_IO_FAILED"),
    message: Schema.String,
  }
) {}

/** Maps target lookup IO into one typed Convex failure. */
/** Public failure payload keeps the domain tag while preserving the deployed code/message transport. */
