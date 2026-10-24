import { Schema } from "effect";

/** The Xendit session kinds Nakafa opens. Each is documented in Create Session. */
const XenditSessionType = Schema.Literals(["PAY", "SAVE", "SUBSCRIPTION"]);

/** Hosted checkout: the buyer opens `payment_link_url`, and the outcome arrives by webhook. */
const XenditSessionStatus = Schema.Literals([
  "ACTIVE",
  "COMPLETED",
  "EXPIRED",
  "CANCELED",
]);

/** The intervals a Xendit recurring schedule takes in a session. */
const XenditInterval = Schema.Literals(["DAY", "WEEK", "MONTH"]);

const positiveInt = Schema.Int.check(Schema.isGreaterThanOrEqualTo(1));

/** The schedule of a subscription session. `anchor_date` is an ISO date-time. */
const XenditSubscriptionSchedule = Schema.Struct({
  anchor_date: Schema.String,
  interval: XenditInterval,
  interval_count: positiveInt,
  total_recurrence: Schema.optionalKey(positiveInt),
});

/** The fields of Create Session that Nakafa sends for an Indonesian Pro or School checkout. */
export const XenditSessionRequest = Schema.Struct({
  reference_id: Schema.String.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(64)
  ),
  session_type: XenditSessionType,
  mode: Schema.Literal("PAYMENT_LINK"),
  currency: Schema.Literal("IDR"),
  amount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  country: Schema.Literal("ID"),
  customer_id: Schema.optionalKey(Schema.String),
  description: Schema.optionalKey(Schema.String),
  locale: Schema.optionalKey(Schema.String),
  success_return_url: Schema.optionalKey(Schema.String),
  cancel_return_url: Schema.optionalKey(Schema.String),
  subscription: Schema.optionalKey(
    Schema.Struct({
      schedule: XenditSubscriptionSchedule,
      failed_cycle_action: Schema.optionalKey(
        Schema.Literals(["RESUME", "STOP"])
      ),
    })
  ),
});
export type XenditSessionRequest = typeof XenditSessionRequest.Type;

/** The fields of the 201 answer that the checkout and the billing row need. */
export const XenditSessionResponse = Schema.Struct({
  payment_session_id: Schema.String,
  reference_id: Schema.String,
  session_type: XenditSessionType,
  status: XenditSessionStatus,
  payment_link_url: Schema.NullOr(Schema.String),
  recurring_plan_id: Schema.NullOr(Schema.String),
  payment_id: Schema.NullOr(Schema.String),
  payment_token_id: Schema.NullOr(Schema.String),
});
export type XenditSessionResponse = typeof XenditSessionResponse.Type;

/** A recurring plan's lifecycle, as Get Plan reports it. */
const XenditPlanStatus = Schema.Literals([
  "ACTIVE",
  "INACTIVE",
  "PENDING",
  "REQUIRES_ACTION",
]);

/** The fields of a recurring plan that the billing row reads. */
export const XenditPlan = Schema.Struct({
  id: Schema.String,
  status: XenditPlanStatus,
  reference_id: Schema.String,
  customer_id: Schema.String,
  currency: Schema.String,
  amount: Schema.Finite,
  recurring_cycle_count: Schema.Int,
  created: Schema.String,
  updated: Schema.String,
});
export type XenditPlan = typeof XenditPlan.Type;

/** A Xendit error body: a code and a message, as every 4xx and 5xx answer carries them. */
export const XenditErrorBody = Schema.Struct({
  error_code: Schema.String,
  message: Schema.String,
});
