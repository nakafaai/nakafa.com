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
 * Extract and validate schoolId from metadata.
 * Returns undefined if not present or invalid.
 */
function getSchoolIdFromMetadata(
  metadata: Record<string, unknown>
): string | undefined {
  const { schoolId } = metadata;
  if (typeof schoolId === "string" && schoolId.length > 0) {
    return schoolId;
  }
}

/**
 * Convert one decoded Polar subscription to database format.
 * Dates are stored as Date.toISOString() strings, the form the tryout access
 * query compares. schoolId is extracted from metadata if present (for school
 * subscriptions).
 */
export function convertToDatabaseSubscription(
  subscription: PolarSubscriptionSource
): WithoutSystemFields<Docs["subscriptions"]> {
  const schoolId = getSchoolIdFromMetadata(subscription.metadata);
  return {
    id: subscription.id,
    customerId: subscription.customerId,
    ...(schoolId === undefined
      ? {}
      : {
          schoolId,
        }),
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
