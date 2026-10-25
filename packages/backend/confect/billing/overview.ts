import type { Docs, UsersDoc } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { findAccount } from "@repo/backend/confect/billing/accounts";
import type {
  BillingRail,
  billingOverviewValidator,
  billingSubscriptionSummaryValidator,
} from "@repo/backend/confect/billing/schema";
import { getPlanCreditConfig } from "@repo/backend/confect/credits/constants";
import {
  getCurrentCreditResetTimestamp,
  getEffectiveCreditStateForResetTimestamp,
  getNextCreditResetTimestamp,
} from "@repo/backend/confect/credits/state";
import { Effect, Option } from "effect";

type BillingSubscription = Docs["billingSubscriptions"];
type BillingSubscriptionSummary =
  typeof billingSubscriptionSummaryValidator.Type;

/** The rails a personal account can pay through, in the order the overview reads them. */
const RAILS: readonly BillingRail[] = ["polar", "xendit"];

/**
 * The statuses the settings show a subscription in, in the order they are read.
 * An ended subscription shows nothing, because its paid period is over.
 */
const SHOWN_STATUSES = ["active", "pastDue", "canceled"] as const;

/** The first subscription of one account in a shown status, on the index that pairs the account with the status. */
const readShownSubscription = Effect.fn(
  "billing.overview.readShownSubscription"
)(function* (accountId: Docs["billingAccounts"]["_id"]) {
  const reader = yield* DatabaseReader;
  for (const status of SHOWN_STATUSES) {
    const subscription = yield* reader
      .table("billingSubscriptions")
      .index("by_accountId_and_status", (query) =>
        query.eq("accountId", accountId).eq("status", status)
      )
      .first()
      .pipe(Effect.orDie);
    if (Option.isSome(subscription)) {
      return subscription;
    }
  }
  return Option.none<BillingSubscription>();
});

/** The subscription a viewer holds on a personal account, with the rail that bills it, or none. */
const readPersonalSubscription = Effect.fn(
  "billing.overview.readPersonalSubscription"
)(function* (userId: Docs["users"]["_id"]) {
  const owner = { kind: "personal" as const, userId };
  for (const rail of RAILS) {
    const account = yield* findAccount(owner, rail);
    if (Option.isNone(account)) {
      continue;
    }
    const subscription = yield* readShownSubscription(account.value._id);
    if (Option.isSome(subscription)) {
      return Option.some({ rail, subscription: subscription.value });
    }
  }
  return Option.none<{
    rail: BillingRail;
    subscription: BillingSubscription;
  }>();
});

/** The subscription as the settings show it: its offer, its state, its paid period, and its rail. */
function summaryOf(
  rail: BillingRail,
  subscription: BillingSubscription
): BillingSubscriptionSummary {
  return {
    offer: subscription.offer,
    status: subscription.status,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    rail,
  };
}

/**
 * The billing overview of one viewer at `now`: the plan the grants project, the
 * subscription that bills it, and the Nina credits of the current reset period,
 * with the moment the balance refills next. Every read is an index read.
 */
export const readBillingOverview = Effect.fn("billing.overview.read")(
  function* (user: UsersDoc, now: number) {
    const personal = yield* readPersonalSubscription(user._id);
    const credits = getEffectiveCreditStateForResetTimestamp(
      user,
      getCurrentCreditResetTimestamp(user.plan, now)
    );
    return {
      plan: user.plan,
      subscription: Option.match(personal, {
        onNone: () => null,
        onSome: ({ rail, subscription }) => summaryOf(rail, subscription),
      }),
      credits: {
        allowance: getPlanCreditConfig(user.plan).amount,
        balance: credits.credits,
        resetAt: getNextCreditResetTimestamp(user.plan, now),
      },
    } satisfies typeof billingOverviewValidator.Type;
  }
);
