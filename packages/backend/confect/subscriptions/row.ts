import type { Docs } from "@repo/backend/confect/_generated/docs";
import type { PolarSubscriptionSource } from "@repo/backend/confect/customers/polar/payload";
import type { SubscriptionRecurringInterval } from "@repo/backend/confect/subscriptions/schema";
import type { WithoutSystemFields } from "convex/server";

const INTERVAL_MAP: Record<string, SubscriptionRecurringInterval> = {
  day: "day",
  week: "week",
  month: "month",
  year: "year",
};

/**
 * Maps a Polar recurring interval to the stored one. Polar may send intervals
 * this repository does not store, and those map to null.
 */
function normalizeRecurringInterval(
  interval: string
): SubscriptionRecurringInterval | null {
  return INTERVAL_MAP[interval] ?? null;
}

/**
 * Convert one decoded Polar subscription to database format.
 * Dates are stored as Date.toISOString() strings, the form the tryout access
 * query compares. The metadata is stored whole, as Polar sent it.
 */
export function convertToDatabaseSubscription(
  subscription: PolarSubscriptionSource
): WithoutSystemFields<Docs["subscriptions"]> {
  return {
    id: subscription.id,
    customerId: subscription.customerId,
    createdAt: subscription.createdAt.toISOString(),
    modifiedAt: subscription.modifiedAt?.toISOString() ?? null,
    productId: subscription.productId,
    checkoutId: subscription.checkoutId,
    amount: subscription.amount,
    currency: subscription.currency,
    recurringInterval: normalizeRecurringInterval(
      subscription.recurringInterval
    ),
    status: subscription.status,
    currentPeriodStart: subscription.currentPeriodStart.toISOString(),
    currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    customerCancellationReason: subscription.customerCancellationReason,
    customerCancellationComment: subscription.customerCancellationComment,
    startedAt: subscription.startedAt?.toISOString() ?? null,
    endedAt: subscription.endedAt?.toISOString() ?? null,
    metadata: subscription.metadata,
  };
}
