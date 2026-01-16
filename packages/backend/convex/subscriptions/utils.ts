import type { Subscription } from "@polar-sh/sdk/models/components/subscription.js";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { SubscriptionRecurringInterval } from "@repo/backend/convex/subscriptions/schema";
import type { WithoutSystemFields } from "convex/server";

const INTERVAL_MAP: Record<string, SubscriptionRecurringInterval> = {
  day: "day",
  week: "week",
  month: "month",
  year: "year",
};

/**
 * Validate and normalize recurring interval from Polar SDK.
 * SDK uses open enums that may include unrecognized values.
 */
function normalizeRecurringInterval(
  interval: string | null | undefined
): SubscriptionRecurringInterval | null {
  return (interval && INTERVAL_MAP[interval]) || null;
}

/**
 * Extract and validate schoolId from metadata.
 * Returns undefined if not present or invalid.
 */
function getSchoolIdFromMetadata(
  metadata: Record<string, unknown>
): Id<"schools"> | undefined {
  const { schoolId } = metadata;
  if (typeof schoolId === "string" && schoolId.length > 0) {
    return schoolId as Id<"schools">;
  }
}

/**
 * Convert Polar subscription to database format.
 * Converts Date objects to ISO strings for storage.
 * schoolId is extracted from metadata if present (for school subscriptions).
 */
export function convertToDatabaseSubscription(
  subscription: Subscription
): WithoutSystemFields<Doc<"subscriptions">> {
  return {
    id: subscription.id,
    customerId: subscription.customerId,
    schoolId: getSchoolIdFromMetadata(subscription.metadata),
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
    currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    customerCancellationReason: subscription.customerCancellationReason,
    customerCancellationComment: subscription.customerCancellationComment,
    startedAt: subscription.startedAt?.toISOString() ?? null,
    endedAt: subscription.endedAt?.toISOString() ?? null,
    metadata: subscription.metadata,
  };
}
