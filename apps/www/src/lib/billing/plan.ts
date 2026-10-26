import type {
  BillingRail,
  billingOverviewValidator,
  billingSubscriptionSummaryValidator,
} from "@repo/backend/confect/billing/schema";
import { Number as Num } from "effect";

/** What the billing settings show for a viewer. */
export type BillingOverview = typeof billingOverviewValidator.Type;

/** One subscription the billing settings show. */
export type BillingSubscription =
  typeof billingSubscriptionSummaryValidator.Type;

/** The name of the credits a viewer spends now: their school's day while they draw from its pool (K46), otherwise their plan's period. */
export function creditPeriodKey({ credits, plan }: BillingOverview) {
  if (credits.pool !== null) {
    return "school-credits";
  }
  return plan === "pro" ? "credits-month" : "credits-today";
}

/** The credits card's footer sentence for a viewer who buys no pack there: a school member's pool, or the Free upgrade. */
export function creditFooterKey({ credits }: BillingOverview) {
  return credits.pool === null
    ? "credits-free-footer"
    : "school-credits-footer";
}

/**
 * The state of the plan card for one overview. A subscription on the account
 * decides the card, so a past-due subscription keeps its billing portal in reach.
 * Without one, the plan the grants project decides: Free shows the upgrade, and
 * Pro that no subscription on this account bills is granted from elsewhere.
 * `ending` means the subscription stops with its paid period, because it cancels
 * there or is already canceled. Nothing decodes this state, so its type is the
 * union that this function returns.
 */
export function planStateOf(overview: BillingOverview) {
  const { subscription } = overview;
  if (subscription !== null) {
    return {
      kind: "subscribed",
      subscription,
      ending:
        subscription.cancelAtPeriodEnd || subscription.status === "canceled",
      pastDue: subscription.status === "pastDue",
    } as const;
  }
  if (overview.plan === "pro") {
    return { kind: "granted" } as const;
  }
  return { kind: "free" } as const;
}

/** The plan card's state, as `planStateOf` returns it. */
export type PlanState = ReturnType<typeof planStateOf>;

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
 * A calendar day in the words of one locale, read in Asia/Jakarta, the zone of
 * Nakafa's Indonesian billing. The server and the browser then write the same
 * day, whatever zone the viewer is in. The credit reset falls on 00:00 UTC, which
 * is 07:00 on the same day in Jakarta.
 */
export function formatBillingDate(moment: number, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeZone: "Asia/Jakarta",
  }).format(moment);
}

/** A count of credits in the digits of one locale. */
export function formatCount(count: number, locale: string) {
  return new Intl.NumberFormat(locale).format(count);
}

/**
 * How much of the period's allowance the viewer has used, in whole percent from 0 to 100. A balance
 * above the allowance, such as one a grant raised, counts as nothing used, and a period that grants
 * nothing counts as all used.
 */
export function usedPercent({
  allowance,
  balance,
}: Pick<BillingOverview["credits"], "allowance" | "balance">) {
  if (allowance <= 0) {
    return 100;
  }
  return Num.clamp(Math.round(((allowance - balance) / allowance) * 100), {
    maximum: 100,
    minimum: 0,
  });
}
