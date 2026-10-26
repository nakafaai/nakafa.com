import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  type BillingOfferKey,
  billingOffer,
} from "@repo/backend/confect/billing/catalog";
import { polarOfferOf } from "@repo/backend/confect/billing/polar/catalog";
import type { PolarSubscriptionSource } from "@repo/backend/confect/billing/polar/payload";
import type { billingSubscriptionStatusValidator } from "@repo/backend/confect/billing/schema";
import type { BillingSubscriptionState } from "@repo/backend/confect/billing/subscriptions";
import { Match, Option, Predicate, Schema } from "effect";

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

/**
 * The catalog offer of a Polar subscription: the offer its product sells, on
 * either server, when that offer belongs to `product` and bills on the
 * subscription's interval. A one-time product, an unknown product, an offer of
 * another product, or an interval the offer does not bill sells nothing here.
 */
function offerOf(
  subscription: PolarSubscriptionSource,
  product: "pro" | "school"
): BillingOfferKey | null {
  return polarOfferOf(subscription.productId).pipe(
    Option.filter((offer) => {
      const sold = billingOffer(offer);
      return (
        sold.product === product &&
        sold.interval === subscription.recurringInterval
      );
    }),
    Option.getOrNull
  );
}

/** The school a Polar subscription pays seats for, with its School offer: a School product whose checkout named the school. */
export function polarSchoolOf(subscription: PolarSubscriptionSource) {
  const offer = offerOf(subscription, "school");
  const tenantId = subscription.metadata?.tenantId;
  if (offer === null || !Predicate.isString(tenantId)) {
    return Option.none<{ offer: BillingOfferKey; tenantId: string }>();
  }
  return Option.some({ offer, tenantId });
}

/**
 * One Polar subscription as the billing model holds it, for the account that pays
 * it and the offer it sells: one seat for Pro, one per enrolled student for School.
 */
export function polarStateOf(
  accountId: Docs["billingAccounts"]["_id"],
  subscription: PolarSubscriptionSource,
  offer: BillingOfferKey
): BillingSubscriptionState {
  return {
    accountId,
    offer,
    quantity:
      billingOffer(offer).product === "school"
        ? Math.max(subscription.seats ?? 1, 1)
        : 1,
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
  };
}

/**
 * Maps one Polar Pro subscription onto the billing model for the learner's
 * account. A subscription whose product or interval Nakafa does not sell as Pro
 * maps to nothing, so it is never guessed at.
 */
export function polarSubscriptionState(
  accountId: Docs["billingAccounts"]["_id"],
  subscription: PolarSubscriptionSource
): Option.Option<BillingSubscriptionState> {
  return Option.map(
    Option.fromNullishOr(offerOf(subscription, "pro")),
    (offer) => polarStateOf(accountId, subscription, offer)
  );
}

/**
 * What one Polar subscription does to the grant of its paid period. `window`
 * writes the paid period as the grant. `endAt` ends the grant at that instant and
 * never extends it.
 */
const PolarGrantAction = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("window") }),
  Schema.Struct({ endsAt: Schema.Finite, kind: Schema.Literal("endAt") }),
]).pipe(Schema.toTaggedUnion("kind"));
type PolarGrantAction = typeof PolarGrantAction.Type;

/**
 * The grant action of one Polar subscription at `now`. An active subscription
 * writes its paid period. A failed renewal ends the grant at `past_due_at`, because
 * Polar advances the period before it charges, so the period it reports is unpaid.
 * A canceled subscription ends at `ended_at`. An incomplete subscription never paid,
 * so it ends now, and so does any status Nakafa does not know.
 */
export function polarGrantAction(
  subscription: PolarSubscriptionSource,
  now: number
): PolarGrantAction {
  return Match.value(subscription.status).pipe(
    Match.withReturnType<PolarGrantAction>(),
    Match.whenOr("active", "trialing", () => ({ kind: "window" as const })),
    Match.whenOr("past_due", "unpaid", () => ({
      kind: "endAt" as const,
      endsAt: subscription.pastDueAt?.getTime() ?? now,
    })),
    Match.when("canceled", () => ({
      kind: "endAt" as const,
      endsAt: subscription.endedAt?.getTime() ?? now,
    })),
    Match.orElse(() => ({ kind: "endAt" as const, endsAt: now }))
  );
}
