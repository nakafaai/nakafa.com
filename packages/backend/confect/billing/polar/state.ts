import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  BillingCurrency,
  BillingOfferKey,
} from "@repo/backend/confect/billing/catalog";
import { products } from "@repo/backend/confect/billing/polar/products";
import { billingSubscriptionStatusValidator } from "@repo/backend/confect/billing/schema";

type BillingSubscriptionStatus = typeof billingSubscriptionStatusValidator.Type;

import type { WithoutSystemFields } from "convex/server";
import { DateTime, Match, Option, Schema } from "effect";

/** A stored Polar subscription row, without the system fields a fixture need not carry. */
export type PolarSubscriptionRow = WithoutSystemFields<Docs["subscriptions"]>;

/** One stored Polar subscription as the billing model holds it, before its account is known. */
const PolarBillingState = Schema.Struct({
  offer: BillingOfferKey,
  currency: BillingCurrency,
  status: billingSubscriptionStatusValidator,
  currentPeriodStart: Schema.Finite,
  currentPeriodEnd: Schema.NullOr(Schema.Finite),
  cancelAtPeriodEnd: Schema.Boolean,
  providerUpdatedAt: Schema.Finite,
  subscriptionId: Schema.String,
  productId: Schema.String,
  priceId: Schema.NullOr(Schema.String),
});
type PolarBillingState = typeof PolarBillingState.Type;

/** Polar's subscription statuses in the billing lifecycle. A status not listed stays pending. */
function statusOf(row: PolarSubscriptionRow): BillingSubscriptionStatus {
  return Match.value(row.status).pipe(
    Match.withReturnType<BillingSubscriptionStatus>(),
    Match.whenOr("active", "trialing", () => "active"),
    Match.whenOr("past_due", "unpaid", () => "pastDue"),
    Match.when("canceled", () => (row.endedAt === null ? "canceled" : "ended")),
    Match.when("incomplete_expired", () => "ended"),
    Match.orElse(() => "pending")
  );
}

/** The catalog offer of a Polar Pro subscription, by its recurring interval. */
function offerOf(row: PolarSubscriptionRow): BillingOfferKey | null {
  if (row.productId !== products.pro.id) {
    return null;
  }
  return Match.value(row.recurringInterval).pipe(
    Match.withReturnType<BillingOfferKey | null>(),
    Match.when("month", () => "pro.monthly"),
    Match.when("year", () => "pro.yearly"),
    Match.orElse(() => null)
  );
}

/** The currency a Polar row bills in, when the catalog sells in it. Polar sends lowercase codes. */
function currencyOf(row: PolarSubscriptionRow): BillingCurrency | null {
  const code = row.currency?.toUpperCase();
  return code === "IDR" || code === "EUR" || code === "USD" ? code : null;
}

/** An ISO time the old tables stored, as epoch milliseconds, or none when the text is not a time. */
function millisOf(iso: string): Option.Option<number> {
  return Option.map(DateTime.make(iso), DateTime.toEpochMillis);
}

/**
 * Maps one stored Polar subscription onto the billing model. A row whose product,
 * interval, or currency the catalog does not sell maps to nothing, so the copy
 * counts it as skipped instead of guessing what it means.
 */
export function polarBillingState(
  row: PolarSubscriptionRow
): Option.Option<PolarBillingState> {
  const offer = offerOf(row);
  const currency = currencyOf(row);
  if (offer === null || currency === null) {
    return Option.none();
  }
  const periodStart = millisOf(row.currentPeriodStart);
  // A row Polar never modified has no modifiedAt, so its creation is its last change.
  const providerUpdatedAt = millisOf(row.modifiedAt ?? row.createdAt);
  const periodEnd =
    row.currentPeriodEnd === null
      ? Option.some(null)
      : millisOf(row.currentPeriodEnd);
  if (
    Option.isNone(periodStart) ||
    Option.isNone(providerUpdatedAt) ||
    Option.isNone(periodEnd)
  ) {
    return Option.none();
  }
  return Option.some({
    offer,
    currency,
    status: statusOf(row),
    currentPeriodStart: periodStart.value,
    currentPeriodEnd: periodEnd.value,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    providerUpdatedAt: providerUpdatedAt.value,
    subscriptionId: row.id,
    productId: row.productId,
    priceId: row.priceId ?? null,
  });
}
