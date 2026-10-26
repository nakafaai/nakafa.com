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

/**
 * The schedule of a subscription session. `anchor_date` is an ISO date-time whose
 * day of the month is at most 28. A failed charge is retried every
 * `retry_interval_count` `retry_interval`s, `total_retry` times, and the attempts
 * `failed_attempt_notifications` names tell the buyer it failed.
 */
const XenditSubscriptionSchedule = Schema.Struct({
  anchor_date: Schema.String,
  interval: XenditInterval,
  interval_count: positiveInt,
  total_recurrence: Schema.optionalKey(positiveInt),
  retry_interval: Schema.optionalKey(XenditInterval),
  retry_interval_count: Schema.optionalKey(positiveInt),
  total_retry: Schema.optionalKey(positiveInt),
  failed_attempt_notifications: Schema.optionalKey(Schema.Array(positiveInt)),
});

/**
 * Create Session reads a PAY or SUBSCRIPTION amount as above zero and a SAVE
 * amount as exactly zero (INVALID_AMOUNT), so the request names the rule once.
 */
const amountFitsSessionType = (request: {
  readonly session_type: typeof XenditSessionType.Type;
  readonly amount: number;
}): boolean =>
  request.session_type === "SAVE" ? request.amount === 0 : request.amount > 0;

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
  /** The channels the hosted page offers; Xendit offers every active channel when it is left out. */
  allowed_payment_channels: Schema.optionalKey(Schema.Array(Schema.String)),
  /** When an unpaid session closes, as an ISO date-time; Xendit closes it after 30 minutes when left out. */
  expires_at: Schema.optionalKey(Schema.String),
  subscription: Schema.optionalKey(
    Schema.Struct({
      schedule: XenditSubscriptionSchedule,
      failed_cycle_action: Schema.optionalKey(
        Schema.Literals(["RESUME", "STOP"])
      ),
      /** Charges the first cycle as soon as the buyer links a channel, before `anchor_date`. */
      immediate_payment: Schema.optionalKey(Schema.Boolean),
    })
  ),
}).check(Schema.makeFilter(amountFitsSessionType));
export type XenditSessionRequest = typeof XenditSessionRequest.Type;

/**
 * The fields of the 201 answer that the checkout and the billing row need.
 * Xendit leaves a nullable field out of the answer while it holds nothing (a
 * pay session has no plan, and no session has a payment before it is paid),
 * so each of those may be missing as well as null.
 */
export const XenditSessionResponse = Schema.Struct({
  payment_session_id: Schema.String,
  reference_id: Schema.String,
  session_type: XenditSessionType,
  status: XenditSessionStatus,
  payment_link_url: Schema.optionalKey(Schema.NullOr(Schema.String)),
  recurring_plan_id: Schema.optionalKey(Schema.NullOr(Schema.String)),
  expires_at: Schema.DateTimeUtcFromString,
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

/** The plan a `recurring.plan.*` webhook carries, with the fields the processor reads. */
export const XenditPlanEvent = Schema.Struct({
  id: Schema.String,
  status: XenditPlanStatus,
  updated: Schema.DateTimeUtcFromString,
});

/** One attempt to charge a cycle. Only the fields the billing row reads are named. */
const XenditCycleAttempt = Schema.Struct({
  status: Schema.Literals(["SUCCEEDED", "FAILED", "PENDING"]),
  payment_id: Schema.NullOr(Schema.String),
  created: Schema.DateTimeUtcFromString,
});

/** The cycle a `recurring.cycle.*` webhook carries, with the fields the processor reads. */
export const XenditCycle = Schema.Struct({
  id: Schema.String,
  status: Schema.Literals([
    "SCHEDULED",
    "PENDING",
    "RETRYING",
    "FAILED",
    "SUCCEEDED",
    "CANCELLED",
  ]),
  plan_id: Schema.String,
  currency: Schema.String,
  amount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  scheduled_timestamp: Schema.DateTimeUtcFromString,
  attempt_details: Schema.Array(XenditCycleAttempt),
  updated: Schema.DateTimeUtcFromString,
});
export type XenditCycle = typeof XenditCycle.Type;

/** The fields of Create Customer that Nakafa sends for a person: the Nakafa user ID is the reference. */
export const XenditCustomerRequest = Schema.Struct({
  reference_id: Schema.String.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(255)
  ),
  type: Schema.Literal("INDIVIDUAL"),
  individual_detail: Schema.Struct({ given_names: Schema.String }),
  email: Schema.String,
});
export type XenditCustomerRequest = typeof XenditCustomerRequest.Type;

/** The fields of a Xendit customer that the billing account reads. */
export const XenditCustomer = Schema.Struct({
  id: Schema.String,
  reference_id: Schema.String,
});

/** Get Customers by reference ID answers a page with the matching customers in `data`. */
export const XenditCustomerPage = Schema.Struct({
  data: Schema.Array(XenditCustomer),
});

/** The session a `payment_session.*` webhook carries, with the fields the processor reads. */
export const XenditSessionEvent = Schema.Struct({
  payment_session_id: Schema.String,
  reference_id: Schema.String,
  session_type: XenditSessionType,
  status: XenditSessionStatus,
  payment_id: Schema.optionalKey(Schema.NullOr(Schema.String)),
  recurring_plan_id: Schema.optionalKey(Schema.NullOr(Schema.String)),
});
export type XenditSessionEvent = typeof XenditSessionEvent.Type;

/** A Xendit error body: a code and a message, as every 4xx and 5xx answer carries them. */
export const XenditErrorBody = Schema.Struct({
  error_code: Schema.String,
  message: Schema.String,
});
