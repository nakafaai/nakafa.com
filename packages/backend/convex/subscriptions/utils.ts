import type { Subscription } from "@polar-sh/sdk/models/components/subscription.js";
import type { WithoutSystemFields } from "convex/server";
import type { Doc, Id } from "../_generated/dataModel";

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
    recurringInterval: subscription.recurringInterval,
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
