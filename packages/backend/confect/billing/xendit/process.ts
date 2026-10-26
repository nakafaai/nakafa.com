import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  BillingCurrency,
  billingOffer,
} from "@repo/backend/confect/billing/catalog";
import { endSubscriptionGrant } from "@repo/backend/confect/billing/grantEnd";
import { syncSubscriptionGrant } from "@repo/backend/confect/billing/grants";
import { recordPayment } from "@repo/backend/confect/billing/payments";
import {
  BillingRowMissing,
  RailMismatch,
} from "@repo/backend/confect/billing/spec";
import {
  applySubscriptionState,
  type BillingSubscriptionState,
  readSubscriptionByXenditPlan,
} from "@repo/backend/confect/billing/subscriptions";
import {
  XenditCycle,
  XenditPlanEvent,
} from "@repo/backend/confect/billing/xendit/contract";
import {
  applySessionCompleted,
  applySessionExpired,
} from "@repo/backend/confect/billing/xendit/session";
import { Array as Arr, DateTime, Effect, Match, Option, Schema } from "effect";

/** The envelope with its data left raw, so each event decodes the data it carries. */
const RawEnvelope = Schema.Struct({
  event: Schema.String,
  data: Schema.Unknown,
});
const decodeEnvelope = Schema.decodeUnknownOption(
  Schema.fromJsonString(RawEnvelope)
);
const decodePlan = Schema.decodeUnknownOption(XenditPlanEvent);
const decodeCycle = Schema.decodeUnknownOption(XenditCycle);
const decodeCurrency = Schema.decodeUnknownOption(BillingCurrency);

/** The fields one provider state sets on a subscription. Every other field keeps its stored value. */
type SubscriptionChange = Pick<
  BillingSubscriptionState,
  | "status"
  | "cancelAtPeriodEnd"
  | "currentPeriodStart"
  | "currentPeriodEnd"
  | "providerUpdatedAt"
>;

/** The account of a subscription must be a Xendit account, because only a Xendit event names a Xendit plan. */
const requireXenditAccount = Effect.fn("billing.xendit.process.requireAccount")(
  function* (accountId: Docs["billingAccounts"]["_id"]) {
    const reader = yield* DatabaseReader;
    const account = yield* reader
      .table("billingAccounts")
      .get(accountId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (account === null) {
      return yield* new BillingRowMissing({
        table: "billingAccounts",
        message: `Account ${accountId} is gone.`,
      });
    }
    if (account.rail !== "xendit") {
      return yield* new RailMismatch({
        rail: account.rail,
        message: `Account ${accountId} is on ${account.rail}, not xendit.`,
      });
    }
    return account;
  }
);

/** Writes one provider state over a stored subscription and reports whether it applied or was stale. */
const applyChange = Effect.fn("billing.xendit.process.applyChange")(function* (
  subscription: Docs["billingSubscriptions"],
  change: SubscriptionChange
) {
  const applied = yield* applySubscriptionState({
    accountId: subscription.accountId,
    offer: subscription.offer,
    quantity: subscription.quantity,
    provider: subscription.provider,
    ...change,
  });
  return applied.kind === "stale" ? ("stale" as const) : ("applied" as const);
});

/** Ends the grant of a subscription at the end of its paid period, when the subscription has one. */
const endAtPaidPeriod = Effect.fn("billing.xendit.process.endAtPaidPeriod")(
  function* (row: Docs["billingSubscriptions"]) {
    if (row.currentPeriodEnd !== null) {
      yield* endSubscriptionGrant(row._id, row.currentPeriodEnd);
    }
  }
);

/** A recurring plan turned on or off: its status changes, and its paid period stays as it is. */
const applyPlan = Effect.fn("billing.xendit.process.plan")(function* (
  data: unknown,
  status: "active" | "canceled"
) {
  const plan = decodePlan(data);
  if (Option.isNone(plan)) {
    return "invalid" as const;
  }
  const subscription = yield* readSubscriptionByXenditPlan(plan.value.id);
  if (Option.isNone(subscription)) {
    return "unknownPlan" as const;
  }
  const row = subscription.value;
  yield* requireXenditAccount(row.accountId);
  const outcome = yield* applyChange(row, {
    status,
    cancelAtPeriodEnd: status === "canceled",
    currentPeriodStart: row.currentPeriodStart,
    currentPeriodEnd: row.currentPeriodEnd,
    providerUpdatedAt: DateTime.toEpochMillis(plan.value.updated),
  });
  // A plan turned off keeps its paid period, and no period after it is granted.
  if (outcome === "applied" && status === "canceled") {
    yield* endAtPaidPeriod(row);
  }
  return outcome;
});

/** A cycle charged and paid: its payment is recorded, and its period becomes the paid window with a grant. */
const applyCycleSucceeded = Effect.fn("billing.xendit.process.succeeded")(
  function* (data: unknown) {
    const decoded = decodeCycle(data);
    if (Option.isNone(decoded)) {
      return "invalid" as const;
    }
    const cycle = decoded.value;
    const subscription = yield* readSubscriptionByXenditPlan(cycle.plan_id);
    if (Option.isNone(subscription)) {
      return "unknownPlan" as const;
    }
    const row = subscription.value;
    const currency = decodeCurrency(cycle.currency);
    const attempt = Arr.findFirst(
      cycle.attempt_details,
      (candidate) => candidate.status === "SUCCEEDED"
    );
    if (Option.isNone(currency) || Option.isNone(attempt)) {
      return "invalid" as const;
    }
    yield* requireXenditAccount(row.accountId);
    const updatedAt = DateTime.toEpochMillis(cycle.updated);
    yield* recordPayment({
      kind: "cycle",
      accountId: row.accountId,
      subscriptionId: row._id,
      status: "succeeded",
      amount: cycle.amount,
      currency: currency.value,
      rail: "xendit",
      providerPaymentId: attempt.value.payment_id ?? cycle.id,
      providerUpdatedAt: updatedAt,
      method: "recurring",
      paidAt: DateTime.toEpochMillis(attempt.value.created),
    });
    const periodStart = DateTime.toEpochMillis(cycle.scheduled_timestamp);
    const periodEnd = DateTime.toEpochMillis(
      DateTime.add(DateTime.makeUnsafe(periodStart), {
        months: billingOffer(row.offer).months,
      })
    );
    const outcome = yield* applyChange(row, {
      status: "active",
      cancelAtPeriodEnd: row.cancelAtPeriodEnd,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      providerUpdatedAt: updatedAt,
    });
    if (outcome === "applied") {
      yield* syncSubscriptionGrant(row._id);
    }
    return outcome;
  }
);

/** A cycle the provider could not charge: the subscription is past due, and its paid period is kept until it ends. */
const applyCycleFailed = Effect.fn("billing.xendit.process.failed")(function* (
  data: unknown
) {
  const decoded = decodeCycle(data);
  if (Option.isNone(decoded)) {
    return "invalid" as const;
  }
  const cycle = decoded.value;
  const subscription = yield* readSubscriptionByXenditPlan(cycle.plan_id);
  if (Option.isNone(subscription)) {
    return "unknownPlan" as const;
  }
  const row = subscription.value;
  yield* requireXenditAccount(row.accountId);
  const outcome = yield* applyChange(row, {
    status: "pastDue",
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    currentPeriodStart: row.currentPeriodStart,
    currentPeriodEnd: row.currentPeriodEnd,
    providerUpdatedAt: DateTime.toEpochMillis(cycle.updated),
  });
  // The failed cycle is unpaid, so the grant ends with the paid period it renewed.
  if (outcome === "applied") {
    yield* endAtPaidPeriod(row);
  }
  return outcome;
});

/** Routes one decoded event to what it changes. Events that change no subscription are ignored. */
const dispatch = (event: string, data: unknown) =>
  Match.value(event).pipe(
    Match.when("recurring.plan.activated", () => applyPlan(data, "active")),
    Match.when("recurring.plan.inactivated", () => applyPlan(data, "canceled")),
    Match.when("recurring.cycle.succeeded", () => applyCycleSucceeded(data)),
    Match.when("recurring.cycle.failed", () => applyCycleFailed(data)),
    Match.when("payment_session.completed", () => applySessionCompleted(data)),
    Match.when("payment_session.expired", () => applySessionExpired(data)),
    Match.orElse(() => Effect.succeed("ignored" as const))
  );

/**
 * Applies one stored Xendit delivery to the billing model and says what it did.
 * A body that does not decode, or names a plan on another rail, is reported and
 * changes nothing. A plan Nakafa holds no row for is reported as unknown.
 */
export const processXenditEvent = Effect.fn("billing.xendit.process")(
  function* (payload: string) {
    const envelope = decodeEnvelope(payload);
    if (Option.isNone(envelope)) {
      return "invalid" as const;
    }
    return yield* dispatch(envelope.value.event, envelope.value.data).pipe(
      Effect.catchTag("RailMismatch", () =>
        Effect.succeed("railMismatch" as const)
      )
    );
  }
);
