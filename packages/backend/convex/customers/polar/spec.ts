import type { polarMetadataValidator } from "@repo/backend/convex/customers/schema";
import type { ConvexTaggedError } from "@repo/backend/convex/lib/effect";
import { type Infer, v } from "convex/values";
import type { Effect } from "effect";
import { Schema } from "effect";

export const polarCheckoutErrorCode = "POLAR_CHECKOUT_ERROR";
export const polarCustomerEmailConflictCode = "POLAR_CUSTOMER_EMAIL_CONFLICT";
export const polarCustomerErrorCode = "POLAR_CUSTOMER_ERROR";
export const polarDeleteErrorCode = "POLAR_DELETE_ERROR";
export const polarDuplicateEmailCode = "POLAR_DUPLICATE_EMAIL";
export const polarPortalErrorCode = "POLAR_PORTAL_ERROR";
export const polarUpdateErrorCode = "POLAR_UPDATE_ERROR";

export const customerIdMetadataKey = "userId";

export const checkoutSessionResultValidator = v.object({
  url: v.string(),
});

export type PolarMetadata = Infer<typeof polarMetadataValidator>;
export type CheckoutSessionResult = Infer<
  typeof checkoutSessionResultValidator
>;

export interface PolarCustomerSource {
  readonly email?: string | null;
  readonly externalId?: string | null;
  readonly id: string;
  readonly metadata?: Record<string, unknown> | null;
  readonly name?: string | null;
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
  readonly embedOrigin?: string;
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

export class PolarCheckoutError
  extends Schema.TaggedError<PolarCheckoutError>()("PolarCheckoutError", {
    code: Schema.Literal(polarCheckoutErrorCode),
    message: Schema.String,
  })
  implements ConvexTaggedError
{
  declare readonly code: typeof polarCheckoutErrorCode;
  declare readonly message: string;
}

export class PolarCustomerEmailConflict
  extends Schema.TaggedError<PolarCustomerEmailConflict>()(
    "PolarCustomerEmailConflict",
    {
      code: Schema.Literal(polarCustomerEmailConflictCode),
      existingExternalId: Schema.NullOr(Schema.String),
      message: Schema.String,
      polarCustomerId: Schema.String,
    }
  )
  implements ConvexTaggedError
{
  declare readonly code: typeof polarCustomerEmailConflictCode;
  declare readonly existingExternalId: string | null;
  declare readonly message: string;
  declare readonly polarCustomerId: string;
}

export class PolarCustomerError
  extends Schema.TaggedError<PolarCustomerError>()("PolarCustomerError", {
    code: Schema.Literal(polarCustomerErrorCode),
    message: Schema.String,
  })
  implements ConvexTaggedError
{
  declare readonly code: typeof polarCustomerErrorCode;
  declare readonly message: string;
}

export class PolarDeleteError
  extends Schema.TaggedError<PolarDeleteError>()("PolarDeleteError", {
    code: Schema.Literal(polarDeleteErrorCode),
    message: Schema.String,
  })
  implements ConvexTaggedError
{
  declare readonly code: typeof polarDeleteErrorCode;
  declare readonly message: string;
}

export class PolarDuplicateEmailError
  extends Schema.TaggedError<PolarDuplicateEmailError>()(
    "PolarDuplicateEmailError",
    {
      code: Schema.Literal(polarDuplicateEmailCode),
      message: Schema.String,
    }
  )
  implements ConvexTaggedError
{
  declare readonly code: typeof polarDuplicateEmailCode;
  declare readonly message: string;
}

export class PolarPortalError
  extends Schema.TaggedError<PolarPortalError>()("PolarPortalError", {
    code: Schema.Literal(polarPortalErrorCode),
    message: Schema.String,
  })
  implements ConvexTaggedError
{
  declare readonly code: typeof polarPortalErrorCode;
  declare readonly message: string;
}

export class PolarUpdateError
  extends Schema.TaggedError<PolarUpdateError>()("PolarUpdateError", {
    code: Schema.Literal(polarUpdateErrorCode),
    message: Schema.String,
  })
  implements ConvexTaggedError
{
  declare readonly code: typeof polarUpdateErrorCode;
  declare readonly message: string;
}

export type PolarCustomerErrorUnion =
  | PolarCheckoutError
  | PolarCustomerEmailConflict
  | PolarCustomerError
  | PolarDeleteError
  | PolarPortalError
  | PolarUpdateError;
