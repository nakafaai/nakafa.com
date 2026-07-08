import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  tryoutEntitlementSourceKindCompetition,
  tryoutEntitlementSourceKindSubscription,
} from "@repo/backend/convex/tryoutAccess/schema";
import { products } from "@repo/backend/convex/utils/polar/products";
import { ConvexError } from "convex/values";

const ENTITLEMENT_LOOKUP_LIMIT = 50;
const SUBSCRIPTION_LOOKUP_LIMIT = 10;
const activeSubscriptionStatus = "active";
const perpetualSubscriptionEndsAt = Number.MAX_SAFE_INTEGER;

interface AttemptAccessFields {
  accessCampaignId?: Id<"tryoutAccessCampaigns">;
  accessEndsAt: number;
  accessGrantId?: Id<"tryoutAccessGrants">;
  accessSubscriptionId?: string;
  countsForCompetition: boolean;
}

type ActiveEntitlement = Doc<"tryoutEntitlements">;
type SubscriptionDoc = Doc<"subscriptions">;

/** Builds the attempt access snapshot from the entitlement used to start it. */
export function getAttemptAccessFields(
  entitlement: ActiveEntitlement
): AttemptAccessFields {
  const access: AttemptAccessFields = {
    accessEndsAt: entitlement.endsAt,
    countsForCompetition:
      entitlement.sourceKind === tryoutEntitlementSourceKindCompetition,
  };

  if (entitlement.accessCampaignId) {
    access.accessCampaignId = entitlement.accessCampaignId;
  }
  if (entitlement.accessGrantId) {
    access.accessGrantId = entitlement.accessGrantId;
  }
  if (entitlement.subscriptionId) {
    access.accessSubscriptionId = entitlement.subscriptionId;
  }

  return access;
}

/** Requires an active entitlement for a concrete set or its parent exam. */
export async function requireActiveEntitlement(
  ctx: MutationCtx,
  args: {
    countryKey: string;
    examKey: string;
    now: number;
    setKey: string;
    trackKey: string;
    userId: Id<"users">;
  }
): Promise<ActiveEntitlement> {
  const setEntitlement = await loadActiveEntitlement(ctx, args);

  if (setEntitlement) {
    return setEntitlement;
  }

  const trackEntitlement = await loadActiveEntitlement(ctx, {
    ...args,
    setKey: undefined,
  });

  if (trackEntitlement) {
    return trackEntitlement;
  }

  const examEntitlement = await loadActiveEntitlement(ctx, {
    ...args,
    setKey: undefined,
    trackKey: undefined,
  });

  if (examEntitlement) {
    return examEntitlement;
  }

  const subscriptionEntitlement = await ensureSubscriptionEntitlement(ctx, {
    countryKey: args.countryKey,
    examKey: args.examKey,
    now: args.now,
    userId: args.userId,
  });

  if (subscriptionEntitlement) {
    return subscriptionEntitlement;
  }

  throw new ConvexError({
    code: "TRYOUT_ACCESS_REQUIRED",
    message: "Try-out access is required for this set.",
  });
}

/** Loads the earliest still-active entitlement for one exact target. */
async function loadActiveEntitlement(
  ctx: MutationCtx,
  args: {
    countryKey: string;
    examKey: string;
    now: number;
    setKey?: string;
    trackKey?: string;
    userId: Id<"users">;
  }
) {
  const entitlements = await ctx.db
    .query("tryoutEntitlements")
    .withIndex("by_user_tryout_scope_endsAt", (q) =>
      q
        .eq("userId", args.userId)
        .eq("countryKey", args.countryKey)
        .eq("examKey", args.examKey)
        .eq("trackKey", args.trackKey)
        .eq("setKey", args.setKey)
        .gt("endsAt", args.now)
    )
    .order("asc")
    .take(ENTITLEMENT_LOOKUP_LIMIT);

  for (const entitlement of entitlements) {
    if (entitlement.startsAt > args.now) {
      continue;
    }

    if (await isSubscriptionEntitlementActive(ctx, entitlement, args.now)) {
      return entitlement;
    }
  }

  return null;
}

/** Creates or extends an exam-level entitlement from an active Pro subscription. */
async function ensureSubscriptionEntitlement(
  ctx: MutationCtx,
  args: {
    countryKey: string;
    examKey: string;
    now: number;
    userId: Id<"users">;
  }
) {
  const subscription = await loadActiveProSubscription(ctx, args);

  if (!subscription) {
    return null;
  }

  const endsAt = getSubscriptionEntitlementEndsAt(subscription, args.now);
  if (!endsAt) {
    return null;
  }

  const existing = await ctx.db
    .query("tryoutEntitlements")
    .withIndex("by_user_subscription_scope", (q) =>
      q
        .eq("userId", args.userId)
        .eq("sourceKind", tryoutEntitlementSourceKindSubscription)
        .eq("subscriptionId", subscription.id)
        .eq("countryKey", args.countryKey)
        .eq("examKey", args.examKey)
        .eq("trackKey", undefined)
        .eq("setKey", undefined)
    )
    .unique();

  if (existing) {
    const startsAt = Math.min(existing.startsAt, args.now);

    await ctx.db.patch("tryoutEntitlements", existing._id, {
      endsAt,
      startsAt,
    });

    return {
      ...existing,
      endsAt,
      startsAt,
    };
  }

  const entitlementId = await ctx.db.insert("tryoutEntitlements", {
    countryKey: args.countryKey,
    endsAt,
    examKey: args.examKey,
    sourceKind: tryoutEntitlementSourceKindSubscription,
    startsAt: args.now,
    subscriptionId: subscription.id,
    userId: args.userId,
  });

  return await ctx.db.get(entitlementId);
}

/** Returns whether an entitlement remains backed by a live subscription row. */
async function isSubscriptionEntitlementActive(
  ctx: MutationCtx,
  entitlement: ActiveEntitlement,
  now: number
) {
  if (entitlement.sourceKind !== tryoutEntitlementSourceKindSubscription) {
    return true;
  }

  if (!entitlement.subscriptionId) {
    return false;
  }

  const { subscriptionId } = entitlement;
  const subscription = await ctx.db
    .query("subscriptions")
    .withIndex("by_subscriptionId", (q) => q.eq("id", subscriptionId))
    .unique();

  return isActiveProSubscription(subscription, now);
}

/** Loads one active Pro subscription linked to the user through Polar customer data. */
async function loadActiveProSubscription(
  ctx: MutationCtx,
  args: { now: number; userId: Id<"users"> }
) {
  const customer = await ctx.db
    .query("customers")
    .withIndex("by_userId", (q) => q.eq("userId", args.userId))
    .unique();

  if (!customer) {
    return null;
  }

  const subscriptions = await ctx.db
    .query("subscriptions")
    .withIndex("by_customerId_and_status_and_productId", (q) =>
      q
        .eq("customerId", customer.id)
        .eq("status", activeSubscriptionStatus)
        .eq("productId", products.pro.id)
    )
    .take(SUBSCRIPTION_LOOKUP_LIMIT);

  return (
    subscriptions.find((subscription) =>
      isActiveProSubscription(subscription, args.now)
    ) ?? null
  );
}

/** Returns true when a subscription row currently grants Pro access. */
function isActiveProSubscription(
  subscription: SubscriptionDoc | null,
  now: number
) {
  if (!subscription) {
    return false;
  }

  if (subscription.status !== activeSubscriptionStatus) {
    return false;
  }

  if (subscription.productId !== products.pro.id) {
    return false;
  }

  return Boolean(getSubscriptionEntitlementEndsAt(subscription, now));
}

/** Converts a valid Polar subscription period into the entitlement end timestamp. */
function getSubscriptionEntitlementEndsAt(
  subscription: SubscriptionDoc,
  now: number
) {
  if (!subscription.currentPeriodEnd) {
    return perpetualSubscriptionEndsAt;
  }

  const periodEnd = Date.parse(subscription.currentPeriodEnd);

  if (Number.isNaN(periodEnd)) {
    return null;
  }

  return periodEnd > now ? periodEnd : null;
}
