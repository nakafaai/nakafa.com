import type { ActiveAppLocaleCode as Locale } from "@nakafa/aksara-contracts/locale";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { productAnalyticsEventValidator } from "@repo/backend/confect/analytics/events";
import { accountUnavailableCode } from "@repo/backend/confect/auth/spec";
import type { PolarCheckoutLocale } from "@repo/backend/confect/customers/checkout/localization";
import { publicFailure } from "@repo/backend/confect/failure";
import { Schema } from "effect";
export const invalidCheckoutSuccessUrlCode = "INVALID_CHECKOUT_SUCCESS_URL";
export const checkoutSessionIoErrorCode = "CHECKOUT_SESSION_IO_FAILED";
export interface CheckoutRequestInput {
  readonly locale: Locale;
  readonly successUrl: string;
}
export interface CheckoutRequest {
  readonly locale: Locale;
  readonly polarLocale: PolarCheckoutLocale;
  readonly primaryProductId: string;
  readonly productIds: readonly string[];
  readonly successUrl: string;
}
export const checkoutAdmissionArgsValidator = Schema.Struct({
  event: productAnalyticsEventValidator,
  timestamp: Schema.optionalKey(Schema.Finite),
  userId: IdSchema("users"),
});
export const checkoutAdmissionValidator = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("admitted"),
  }),
  Schema.Struct({
    kind: Schema.Literal("unavailable"),
  }),
]);
export type CheckoutAdmissionArgs = Schema.Schema.Type<
  typeof checkoutAdmissionArgsValidator
>;
export type CheckoutAdmission = Schema.Schema.Type<
  typeof checkoutAdmissionValidator
>;

/** Raised when account revalidation withholds a newly created checkout. */
export class CheckoutUnavailable extends Schema.TaggedError<CheckoutUnavailable>()(
  "CheckoutUnavailable",
  {
    code: Schema.Literal(accountUnavailableCode),
    message: Schema.String,
  }
) {
  declare readonly code: typeof accountUnavailableCode;
  declare readonly message: string;
}
export class CheckoutSessionIoError extends Schema.TaggedError<CheckoutSessionIoError>()(
  "CheckoutSessionIoError",
  {
    code: Schema.Literal(checkoutSessionIoErrorCode),
    cause: Schema.optional(Schema.Unknown),
    message: Schema.String,
  }
) {
  declare readonly code: typeof checkoutSessionIoErrorCode;
  declare readonly message: string;
}

/** Normalizes one Convex checkout boundary failure. */
export const CheckoutSessionIoErrorWire = publicFailure(CheckoutSessionIoError);
export function checkoutSessionIoError(error: unknown) {
  return new CheckoutSessionIoError({
    code: checkoutSessionIoErrorCode,
    cause: error,
    message: "Failed to finish checkout session.",
  });
}
export class InvalidCheckoutSuccessUrl extends Schema.TaggedError<InvalidCheckoutSuccessUrl>()(
  "InvalidCheckoutSuccessUrl",
  {
    code: Schema.Literal(invalidCheckoutSuccessUrlCode),
    message: Schema.String,
  }
) {
  declare readonly code: typeof invalidCheckoutSuccessUrlCode;
  declare readonly message: string;
}
/** Public failure payload keeps the domain tag while preserving the deployed code/message transport. */
