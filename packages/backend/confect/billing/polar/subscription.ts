import type { Docs } from "@repo/backend/confect/_generated/docs";
import type { BillingOfferKey } from "@repo/backend/confect/billing/catalog";
import { proProductIds } from "@repo/backend/confect/billing/polar/catalog";
import type { PolarSubscriptionSource } from "@repo/backend/confect/billing/polar/payload";
import type { billingSubscriptionStatusValidator } from "@repo/backend/confect/billing/schema";
import type { BillingSubscriptionState } from "@repo/backend/confect/billing/subscriptions";
import { Array as Arr, Match, Option } from "effect";

type BillingSubscriptionStatus = typeof billingSubscriptionStatusValidator.Type;

/** The billing status of one Polar subscription. A status Nakafa does not map stays pending, so it grants nothing. */
function statusOf(
  subscription: PolarSubscriptionSource
): BillingSubscriptionStatus {
  return Match.value(subscription.status).pipe(
    Match.withReturnType<BillingSubscriptionStatus>(),
    Match.whenOr("active", "trialing", () => "active"),
    Match.whenOr("past_due", "unpaid", () => "pastDue"),
    Match.when("canceled", () =>
      subscription.endedAt === null ? "canceled" : "ended"
    ),
    Match.when("incomplete_expired", () => "ended"),
    Match.orElse(() => "pending")
  );
}

/** Both servers' Pro products: a deployment bills through one server, and a webhook names the product of its own server. */
const proProductIdValues = [proProductIds.production, proProductIds.sandbox];

/** The catalog offer of a Polar Pro subscription, by its recurring interval. Another product or interval sells no offer. */
function offerOf(
  subscription: PolarSubscriptionSource
): BillingOfferKey | null {
  if (!Arr.contains(proProductIdValues, subscription.productId)) {
    return null;
  }
  return Match.value(subscription.recurringInterval).pipe(
    Match.withReturnType<BillingOfferKey | null>(),
    Match.when("month", () => "pro.monthly"),
    Match.when("year", () => "pro.yearly"),
    Match.orElse(() => null)
  );
}

/**
 * Maps one Polar subscription onto the billing model for the account that owns
 * its customer. A subscription whose product or interval Nakafa does not sell
 * maps to nothing, so it is never guessed at.
 */
export function polarSubscriptionState(
  accountId: Docs["billingAccounts"]["_id"],
  subscription: PolarSubscriptionSource
): Option.Option<BillingSubscriptionState> {
  const offer = offerOf(subscription);
  if (offer === null) {
    return Option.none();
  }
  return Option.some({
    accountId,
    offer,
    quantity: 1,
    status: statusOf(subscription),
    currentPeriodStart: subscription.currentPeriodStart.getTime(),
    currentPeriodEnd: subscription.currentPeriodEnd?.getTime() ?? null,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    provider: {
      kind: "polar",
      subscriptionId: subscription.id,
      productId: subscription.productId,
      priceId: subscription.priceId ?? null,
    },
    // Polar stamps `modifiedAt` on every change; a subscription never modified keeps its creation time.
    providerUpdatedAt: (
      subscription.modifiedAt ?? subscription.createdAt
    ).getTime(),
  });
}
