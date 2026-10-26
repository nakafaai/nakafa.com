import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import {
  billingOffer,
  billingOfferPrice,
} from "@repo/backend/confect/billing/catalog";
import { getXenditCheckoutLocale } from "@repo/backend/confect/billing/locale";
import { ProCheckoutOffer } from "@repo/backend/confect/billing/spec";
import { readSubscription } from "@repo/backend/confect/billing/subscriptions";
import { OFFER_DESCRIPTIONS } from "@repo/backend/confect/billing/xendit/checkout";
import type { XenditPlanRequest } from "@repo/backend/confect/billing/xendit/contract";
import { Array as Arr, DateTime, Duration, Effect, Schema } from "effect";

const isProOffer = Schema.is(ProCheckoutOffer);

/** Xendit accepts no anchor day after the 28th, so a plan whose first month started later in the month renews on the 28th. */
const LAST_ANCHOR_DAY = 28;

/** Western Indonesian Time, UTC+7, in which the day of an Indonesian plan's renewal is read. */
const WIB_OFFSET_MS = Duration.toMillis(Duration.hours(7));

/** A failed renewal is charged again once a day, three times, and each failed attempt tells the buyer. */
const RENEWAL_RETRIES = 3;

/** The statuses of a subscription whose plan keeps charging. */
const RENEWING_STATUSES = ["active", "pastDue"] as const;

/**
 * The first renewal of a plan whose first `months` were paid at `now`: the same
 * day in Western Indonesian Time `months` later, or the 28th when the day is
 * later. The first paid period ends there.
 */
export function renewalAnchor(now: number, months: number) {
  const renewal = DateTime.makeUnsafe(now).pipe(
    DateTime.setZoneOffset(WIB_OFFSET_MS),
    DateTime.add({ months })
  );
  return DateTime.getPart(renewal, "day") > LAST_ANCHOR_DAY
    ? DateTime.setParts(renewal, { day: LAST_ANCHOR_DAY })
    : renewal;
}

/**
 * What opening the plan of one subscription needs, or nothing when no plan
 * should open: the subscription is gone, already has its plan, was canceled
 * before the plan opened, or saved no channel to charge.
 */
export const readRenewal = Effect.fn("billing.xendit.renewal.read")(function* (
  subscriptionId: Docs["billingSubscriptions"]["_id"]
) {
  const subscription = yield* readSubscription(subscriptionId);
  if (
    subscription === null ||
    subscription.provider.kind !== "xendit" ||
    subscription.provider.planId !== null ||
    subscription.provider.tokenId === null ||
    subscription.currentPeriodEnd === null ||
    subscription.cancelAtPeriodEnd ||
    !isProOffer(subscription.offer)
  ) {
    return null;
  }
  const account = yield* (yield* DatabaseReader)
    .table("billingAccounts")
    .get(subscription.accountId)
    .pipe(Effect.orDie);
  const amount = billingOfferPrice(subscription.offer, account.currency);
  if (account.providerCustomerId === null || amount === null) {
    return null;
  }
  return {
    amount,
    anchor: subscription.currentPeriodEnd,
    customerId: account.providerCustomerId,
    months: billingOffer(subscription.offer).months,
    offer: subscription.offer,
    tokenId: subscription.provider.tokenId,
  };
});

/**
 * The recurring plan of a subscription whose first month is paid: it charges
 * the saved channel on the day the paid month ends and every month after,
 * retries a failed charge daily three times, and stops after a renewal that
 * fails every retry, so a lapsed buyer is never charged later.
 */
export function planRequest(input: {
  readonly renewal: NonNullable<Effect.Success<ReturnType<typeof readRenewal>>>;
  readonly locale: ActiveAppLocaleCode;
  readonly referenceId: string;
}): XenditPlanRequest {
  const { renewal } = input;
  const locale = getXenditCheckoutLocale(input.locale);
  return {
    reference_id: input.referenceId,
    customer_id: renewal.customerId,
    currency: "IDR",
    amount: renewal.amount,
    schedule: {
      anchor_date: DateTime.formatIsoOffset(
        DateTime.makeUnsafe(renewal.anchor).pipe(
          DateTime.setZoneOffset(WIB_OFFSET_MS)
        )
      ),
      interval: "MONTH",
      interval_count: renewal.months,
      retry_interval: "DAY",
      retry_interval_count: 1,
      total_retry: RENEWAL_RETRIES,
      failed_attempt_notifications: [1, 2, RENEWAL_RETRIES],
    },
    payment_tokens: [{ payment_token_id: renewal.tokenId, rank: 1 }],
    immediate_payment: false,
    failed_cycle_action: "STOP",
    locale,
    description: OFFER_DESCRIPTIONS[locale][renewal.offer],
  };
}

/** Turns a plan off at Xendit in the background, retried there, so it charges nothing. */
const turnOff = Effect.fn("billing.xendit.renewal.turnOff")(function* (
  planId: string
) {
  yield* (yield* Scheduler).runAfter(
    Duration.zero,
    refs.internal.billing.xendit.cancel.deactivate,
    { planId }
  );
});

/**
 * Names the plan Xendit opened for a subscription, once, and turns the plan off
 * when it must not charge: the subscription was deleted, already has its plan,
 * or was canceled or ended while the plan opened. A canceled subscription still
 * names its plan, so it is on record while Xendit turns it off.
 */
export const recordRenewal = Effect.fn("billing.xendit.renewal.record")(
  function* (
    subscriptionId: Docs["billingSubscriptions"]["_id"],
    planId: string
  ) {
    const subscription = yield* readSubscription(subscriptionId);
    if (
      subscription === null ||
      subscription.provider.kind !== "xendit" ||
      subscription.provider.planId !== null
    ) {
      yield* turnOff(planId);
      return null;
    }
    yield* (yield* DatabaseWriter)
      .table("billingSubscriptions")
      .patch(subscriptionId, {
        provider: { ...subscription.provider, planId },
      })
      .pipe(Effect.orDie);
    if (
      subscription.cancelAtPeriodEnd ||
      !Arr.contains(RENEWING_STATUSES, subscription.status)
    ) {
      yield* turnOff(planId);
    }
    return null;
  }
);
