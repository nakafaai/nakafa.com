import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { productAnalyticsEventValidator } from "@repo/backend/confect/analytics/events";
import { accountUnavailableCode } from "@repo/backend/confect/auth/spec";
import { checkoutLocaleValidator } from "@repo/backend/confect/billing/locale";
import { publicFailure } from "@repo/backend/confect/failure";
import { Schema } from "effect";

/** The billing state could not be read or changed safely. */
export class BillingStateError extends Schema.TaggedError<BillingStateError>()(
  "BillingStateError",
  {
    code: Schema.Literal("BILLING_STATE_FAILED"),
    message: Schema.Literal("Unable to read or update billing state."),
  }
) {}

/** No school carries the slug an operator named, so the command has nothing to record against. */
export class TenantNotFound extends Schema.TaggedError<TenantNotFound>()(
  "TenantNotFound",
  {
    slug: Schema.String,
    message: Schema.String,
  }
) {}

/** A subscription's offer is for one kind of owner, and the account it bills names another. */
export class GrantOwnerMismatch extends Schema.TaggedError<GrantOwnerMismatch>()(
  "GrantOwnerMismatch",
  {
    message: Schema.String,
  }
) {}

/** A row the billing model points at is gone, which means an invariant broke. The write it guards does not happen. */
export class BillingRowMissing extends Schema.TaggedError<BillingRowMissing>()(
  "BillingRowMissing",
  {
    table: Schema.String,
    message: Schema.String,
  }
) {}

/** A provider event names a row on another rail than the one that sent it, so the event is not applied. */
export class RailMismatch extends Schema.TaggedError<RailMismatch>()(
  "RailMismatch",
  {
    rail: Schema.String,
    message: Schema.String,
  }
) {}

/** A school contract ends no later than it starts, so it grants no time. */
export class ContractWindowInvalid extends Schema.TaggedError<ContractWindowInvalid>()(
  "ContractWindowInvalid",
  {
    contractId: Schema.String,
    message: Schema.String,
  }
) {}

/** Raised when Convex IO fails while recomputing one user's plan from its billing grants. */
export const planSyncIoFailedCode = "PLAN_SYNC_IO_FAILED";
export class PlanSyncIoError extends Schema.TaggedError<PlanSyncIoError>()(
  "PlanSyncIoError",
  {
    code: Schema.Literal(planSyncIoFailedCode),
    message: Schema.String,
  }
) {}

export const invalidCheckoutSuccessUrlCode = "INVALID_CHECKOUT_SUCCESS_URL";
const checkoutSessionIoErrorCode = "CHECKOUT_SESSION_IO_FAILED";

/** The learner's checkout request: the locale the page runs in, and where Polar returns the learner. */
export const checkoutRequestInputValidator = Schema.Struct({
  locale: checkoutLocaleValidator,
  successUrl: Schema.String,
});
export type CheckoutRequestInput = typeof checkoutRequestInputValidator.Type;

/**
 * The arguments of the admission that revalidates a checkout once Polar has
 * answered. `requiresPro` admits only a learner whose Pro grant still runs, which
 * is what a top-up pack needs.
 */
export const checkoutAdmissionArgsValidator = Schema.Struct({
  event: productAnalyticsEventValidator,
  requiresPro: Schema.Boolean,
  timestamp: Schema.optionalKey(Schema.Finite),
  userId: IdSchema("users"),
});

/** Whether a checkout still belongs to an account that may buy. */
export const checkoutAdmissionValidator = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("admitted") }),
  Schema.Struct({ kind: Schema.Literal("unavailable") }),
]).pipe(Schema.toTaggedUnion("kind"));
export type CheckoutAdmission = typeof checkoutAdmissionValidator.Type;

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

export const topupRequiresProCode = "TOPUP_REQUIRES_PRO";
/** A top-up pack is sold to a learner on Pro only, and this learner is not on Pro. */
export class TopupRequiresPro extends Schema.TaggedError<TopupRequiresPro>()(
  "TopupRequiresPro",
  {
    code: Schema.Literal(topupRequiresProCode),
    message: Schema.String,
  }
) {
  declare readonly code: typeof topupRequiresProCode;
  declare readonly message: string;
}

/** The success URL is not an absolute URL on the primary site. */
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

/** A Convex boundary failure while a checkout session is prepared. */
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
export const CheckoutSessionIoErrorWire = publicFailure(CheckoutSessionIoError);

/** Normalizes one Convex checkout boundary failure. */
export function checkoutSessionIoError(error: unknown) {
  return new CheckoutSessionIoError({
    code: checkoutSessionIoErrorCode,
    cause: error,
    message: "Failed to finish checkout session.",
  });
}

/** The billing state failure as a public Convex failure. */
export const BillingStateErrorWire = publicFailure(BillingStateError);

/** Raised when a Pro checkout is asked for while the user already holds Pro, through a grant or a subscription that is active or past due. */
export const proAlreadyHeldCode = "BILLING_PRO_ALREADY_HELD";
export class ProAlreadyHeld extends Schema.TaggedError<ProAlreadyHeld>()(
  "ProAlreadyHeld",
  {
    code: Schema.Literal(proAlreadyHeldCode),
    message: Schema.String,
  }
) {
  declare readonly code: typeof proAlreadyHeldCode;
  declare readonly message: string;
}
export const ProAlreadyHeldWire = publicFailure(ProAlreadyHeld);

/** Raised when a Xendit recurring plan could not be turned off, so the account deletion that needs it retries. */
export const xenditDeactivateErrorCode = "XENDIT_DEACTIVATE_ERROR";
export class XenditDeactivateError extends Schema.TaggedError<XenditDeactivateError>()(
  "XenditDeactivateError",
  {
    code: Schema.Literal(xenditDeactivateErrorCode),
    cause: Schema.optional(Schema.Unknown),
    message: Schema.String,
  }
) {
  declare readonly code: typeof xenditDeactivateErrorCode;
  declare readonly message: string;
}
export const XenditDeactivateErrorWire = publicFailure(XenditDeactivateError);

/** What linking a Polar customer to a Nakafa user did. Only `linked` links anything. */
export const LinkPolarCustomerOutcome = Schema.Literals([
  "linked",
  "noUser",
  "unavailable",
  "conflict",
]);
export type LinkPolarCustomerOutcome = typeof LinkPolarCustomerOutcome.Type;

/** The URL of one hosted billing page: a Polar checkout or the customer portal. */
const billingUrlValidator = Schema.Struct({
  url: Schema.String,
});
export type BillingUrl = typeof billingUrlValidator.Type;
