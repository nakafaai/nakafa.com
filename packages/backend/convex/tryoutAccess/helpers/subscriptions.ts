import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { TryoutAccessDbReader } from "@repo/backend/convex/tryoutAccess/helpers/types";
import {
  type TryoutProduct,
  tryoutProducts,
} from "@repo/backend/convex/tryouts/products";
import { products } from "@repo/backend/convex/utils/polar/products";
import { ConvexError } from "convex/values";

const tryoutPaidProductIds = {
  snbt: products.pro.id,
} satisfies Record<TryoutProduct, string>;

/** Parses one ISO timestamp string into a millisecond value. */
function parseTimestamp(value: string | null, fieldName: string) {
  if (!value) {
    return null;
  }

  const parsedValue = Date.parse(value);

  if (!Number.isNaN(parsedValue)) {
    return parsedValue;
  }

  throw new ConvexError({
    code: "INVALID_SUBSCRIPTION_WINDOW",
    message: `Subscription ${fieldName} must be a valid ISO timestamp.`,
  });
}

/** Loads one active subscription whose access window never expires. */
async function getPerpetualActiveSubscriptionForProduct(
  db: TryoutAccessDbReader,
  {
    customerId,
    productId,
  }: {
    customerId: Doc<"subscriptions">["customerId"];
    productId: Doc<"subscriptions">["productId"];
  }
) {
  return await db
    .query("subscriptions")
    .withIndex(
      "by_customerId_and_status_and_productId_and_currentPeriodEnd",
      (q) =>
        q
          .eq("customerId", customerId)
          .eq("status", "active")
          .eq("productId", productId)
          .eq("currentPeriodEnd", null)
    )
    .first();
}

/** Loads the active subscription with the latest stored period end for one product. */
async function getLatestActiveSubscriptionForProduct(
  db: TryoutAccessDbReader,
  {
    customerId,
    productId,
  }: {
    customerId: Doc<"subscriptions">["customerId"];
    productId: Doc<"subscriptions">["productId"];
  }
) {
  const perpetualSubscription = await getPerpetualActiveSubscriptionForProduct(
    db,
    {
      customerId,
      productId,
    }
  );

  if (perpetualSubscription) {
    return perpetualSubscription;
  }

  return await db
    .query("subscriptions")
    .withIndex(
      "by_customerId_and_status_and_productId_and_currentPeriodEnd",
      (q) =>
        q
          .eq("customerId", customerId)
          .eq("status", "active")
          .eq("productId", productId)
    )
    .order("desc")
    .first();
}

/** Loads the canonical active tryout subscriptions that currently grant access. */
export async function listCanonicalActiveTryoutSubscriptions(
  db: TryoutAccessDbReader,
  {
    customerId,
  }: {
    customerId: Doc<"subscriptions">["customerId"];
  }
) {
  const activeSubscriptions = await Promise.all(
    tryoutProducts.map(
      async (product) =>
        await getLatestActiveSubscriptionForProduct(db, {
          customerId,
          productId: tryoutPaidProductIds[product],
        })
    )
  );

  return activeSubscriptions.filter((subscription) => subscription !== null);
}

/** Loads the active subscription that currently grants one user tryout access. */
export async function getActiveTryoutSubscriptionForUserProduct(
  db: TryoutAccessDbReader,
  {
    now,
    product,
    userId,
  }: {
    now: number;
    product: TryoutProduct;
    userId: Doc<"users">["_id"];
  }
) {
  const customer = await db
    .query("customers")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();

  if (!customer) {
    return null;
  }

  const subscription = await getLatestActiveSubscriptionForProduct(db, {
    customerId: customer.id,
    productId: tryoutPaidProductIds[product],
  });

  if (!subscription) {
    return null;
  }

  const startsAt = parseTimestamp(
    subscription.currentPeriodStart,
    "currentPeriodStart"
  );

  if (startsAt === null || startsAt > now) {
    return null;
  }

  const endsAt =
    parseTimestamp(subscription.currentPeriodEnd, "currentPeriodEnd") ??
    Number.MAX_SAFE_INTEGER;

  if (endsAt <= now) {
    return null;
  }

  return {
    endsAt,
    startsAt,
    subscriptionId: subscription._id,
  };
}
