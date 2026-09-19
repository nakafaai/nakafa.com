import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { tryoutEntitlementSourceKindSubscription } from "@repo/backend/convex/tryoutAccess/schema";
import type { TryoutStartScope } from "@repo/backend/convex/tryouts/start/spec";
import { toTryoutStartError } from "@repo/backend/convex/tryouts/start/spec";
import { products } from "@repo/backend/convex/utils/polar/products";
import { Effect } from "effect";

const activeSubscriptionStatus = "active";
const perpetualSubscriptionEndsAt = Number.MAX_SAFE_INTEGER;

type SubscriptionDoc = Doc<"subscriptions">;
type TryoutAccessReadCtx = Pick<QueryCtx, "db">;

/** Loads one active Pro subscription through the user's Polar customer row. */
export const loadActiveProSubscription = Effect.fn(
  "tryouts.access.loadActiveProSubscription"
)(function* (ctx: TryoutAccessReadCtx, args: TryoutStartScope) {
  const customer = yield* tryAccessPromise(() =>
    ctx.db
      .query("customers")
      .withIndex("by_userId", (query) => query.eq("userId", args.userId))
      .unique()
  );

  if (!customer) {
    return null;
  }

  const perpetual = yield* tryAccessPromise(() =>
    ctx.db
      .query("subscriptions")
      .withIndex(
        "by_customerId_and_status_and_productId_and_currentPeriodEnd",
        (query) =>
          query
            .eq("customerId", customer.id)
            .eq("status", activeSubscriptionStatus)
            .eq("productId", products.pro.id)
            .eq("currentPeriodEnd", null)
      )
      .first()
  );

  if (perpetual) {
    return perpetual;
  }

  // Polar ingestion stores UTC ISO strings through Date.toISOString(), so
  // the period index excludes expired rows before reading a document.
  const subscription = yield* tryAccessPromise(() =>
    ctx.db
      .query("subscriptions")
      .withIndex(
        "by_customerId_and_status_and_productId_and_currentPeriodEnd",
        (query) =>
          query
            .eq("customerId", customer.id)
            .eq("status", activeSubscriptionStatus)
            .eq("productId", products.pro.id)
            .gt("currentPeriodEnd", new Date(args.now).toISOString())
      )
      .first()
  );

  return isActiveProSubscription(subscription, args.now) ? subscription : null;
});

/** Creates or refreshes the exam entitlement backed by a live subscription. */
export const ensureSubscriptionEntitlement = Effect.fn(
  "tryouts.access.ensureSubscriptionEntitlement"
)(function* (
  ctx: MutationCtx,
  args: {
    countryKey: string;
    examKey: string;
    now: number;
    subscription: SubscriptionDoc;
    userId: TryoutStartScope["userId"];
  }
) {
  const endsAt = getSubscriptionEntitlementEndsAt(args.subscription, args.now);

  if (!endsAt) {
    return;
  }

  const existing = yield* tryAccessPromise(() =>
    ctx.db
      .query("tryoutEntitlements")
      .withIndex("by_user_subscription_scope", (query) =>
        query
          .eq("userId", args.userId)
          .eq("sourceKind", tryoutEntitlementSourceKindSubscription)
          .eq("subscriptionId", args.subscription.id)
          .eq("countryKey", args.countryKey)
          .eq("examKey", args.examKey)
          .eq("trackKey", undefined)
          .eq("setKey", undefined)
      )
      .unique()
  );

  if (existing) {
    yield* tryAccessPromise(() =>
      ctx.db.patch("tryoutEntitlements", existing._id, {
        endsAt,
        startsAt: Math.min(existing.startsAt, args.now),
      })
    );
    return;
  }

  yield* tryAccessPromise(() =>
    ctx.db.insert("tryoutEntitlements", {
      countryKey: args.countryKey,
      endsAt,
      examKey: args.examKey,
      sourceKind: tryoutEntitlementSourceKindSubscription,
      startsAt: args.now,
      subscriptionId: args.subscription.id,
      userId: args.userId,
    })
  );
});

/** Returns whether a Polar subscription grants Pro access at one timestamp. */
export function isActiveProSubscription(
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

/** Converts one valid Polar period into the entitlement end timestamp. */
export function getSubscriptionEntitlementEndsAt(
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

/** Lifts one Convex read or write into the typed start failure channel. */
function tryAccessPromise<A>(operation: () => Promise<A>) {
  return Effect.tryPromise({ catch: toTryoutStartError, try: operation });
}
