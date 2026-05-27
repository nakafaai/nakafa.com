import type { Subscription } from "@polar-sh/sdk/models/components/subscription.js";
import type { Doc } from "@repo/backend/confect/_generated/dataModel";
import type { SubscriptionRecurringInterval } from "@repo/backend/confect/modules/commerce/subscriptions.tables";

type SubscriptionFields = Omit<Doc<"subscriptions">, "_creationTime" | "_id">;

/** Normalizes Polar subscription intervals to the persisted interval enum. */
function normalizeRecurringInterval(
  interval: string | null | undefined
): SubscriptionRecurringInterval {
  switch (interval) {
    case "day":
    case "month":
    case "week":
    case "year":
      return interval;
    default:
      return null;
  }
}

/** Reads an optional school id from Polar metadata. */
function getSchoolIdFromMetadata(metadata: Record<string, unknown>) {
  const { schoolId } = metadata;

  if (typeof schoolId !== "string" || schoolId.length === 0) {
    return;
  }

  return schoolId;
}

/** Converts a Polar subscription payload into the local subscription row. */
export function convertToDatabaseSubscription(
  subscription: Subscription
): SubscriptionFields {
  return {
    amount: subscription.amount,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    checkoutId: subscription.checkoutId,
    createdAt: subscription.createdAt.toISOString(),
    currency: subscription.currency,
    currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
    currentPeriodStart: subscription.currentPeriodStart.toISOString(),
    customerCancellationComment: subscription.customerCancellationComment,
    customerCancellationReason: subscription.customerCancellationReason,
    customerId: subscription.customerId,
    endedAt: subscription.endedAt?.toISOString() ?? null,
    id: subscription.id,
    metadata: subscription.metadata,
    modifiedAt: subscription.modifiedAt?.toISOString() ?? null,
    productId: subscription.productId,
    recurringInterval: normalizeRecurringInterval(
      subscription.recurringInterval
    ),
    schoolId: getSchoolIdFromMetadata(subscription.metadata),
    startedAt: subscription.startedAt?.toISOString() ?? null,
    status: subscription.status,
  };
}
