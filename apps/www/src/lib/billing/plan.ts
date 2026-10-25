import {
  type BillingRail,
  type billingOverviewValidator,
  billingSubscriptionSummaryValidator,
} from "@repo/backend/confect/billing/schema";
import { Schema } from "effect";

/** What the billing settings show for a viewer. */
export type BillingOverview = typeof billingOverviewValidator.Type;

/** One subscription the billing settings show. */
export type BillingSubscription =
  typeof billingSubscriptionSummaryValidator.Type;

/**
 * The plan card's state. A subscription on the account decides the card, so a
 * past-due subscription keeps its billing portal in reach. Without one, the plan
 * the grants project decides: Free shows the upgrade, and Pro that no subscription
 * on this account bills is granted from elsewhere. `ending` means the subscription
 * stops with its paid period, because it cancels there or is already canceled.
 */
const PlanStateSchema = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("free") }),
  Schema.Struct({ kind: Schema.Literal("granted") }),
  Schema.Struct({
    kind: Schema.Literal("subscribed"),
    subscription: billingSubscriptionSummaryValidator,
    ending: Schema.Boolean,
    pastDue: Schema.Boolean,
  }),
]).pipe(Schema.toTaggedUnion("kind"));
export type PlanState = typeof PlanStateSchema.Type;

/** The state of the plan card for one overview. */
export function planStateOf(overview: BillingOverview): PlanState {
  const { subscription } = overview;
  if (subscription !== null) {
    return {
      kind: "subscribed",
      subscription,
      ending:
        subscription.cancelAtPeriodEnd || subscription.status === "canceled",
      pastDue: subscription.status === "pastDue",
    };
  }
  if (overview.plan === "pro") {
    return { kind: "granted" };
  }
  return { kind: "free" };
}

/** The message that says what a subscribed plan does now: its last payment failed, it ends with its period, or it renews. */
export function subscribedDescriptionKey({
  ending,
  pastDue,
}: {
  ending: boolean;
  pastDue: boolean;
}) {
  if (pastDue) {
    return "plan-pro-past-due-description" as const;
  }
  if (ending) {
    return "plan-pro-ending-description" as const;
  }
  return "plan-pro-description" as const;
}

const PROVIDER_NAMES = {
  polar: "Polar",
  xendit: "Xendit",
} as const satisfies Record<BillingRail, string>;

/** The name of the payment provider that bills a subscription. */
export function providerNameOf(rail: BillingRail) {
  return PROVIDER_NAMES[rail];
}

/**
 * A calendar day in the words of one locale. Billing and credit dates are UTC
 * moments, so the day is read in UTC: the server and the browser then write the
 * same day in any zone.
 */
export function formatBillingDate(moment: number, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(moment);
}

/** A count of credits in the digits of one locale. */
export function formatCount(count: number, locale: string) {
  return new Intl.NumberFormat(locale).format(count);
}
