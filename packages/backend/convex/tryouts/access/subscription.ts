import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import type { TryoutStartScope } from "@repo/backend/convex/tryouts/start/spec";
import { toTryoutStartError } from "@repo/backend/convex/tryouts/start/spec";
import { products } from "@repo/backend/convex/utils/polar/products";
import { Effect } from "effect";

const activeSubscriptionStatus = "active";
const perpetualSubscriptionEndsAt = Number.MAX_SAFE_INTEGER;

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

  // Polar ingestion stores UTC ISO strings through Date.toISOString(), so
  // the period index excludes expired rows before reading a document.
  const subscription =
    perpetual ??
    (yield* tryAccessPromise(() =>
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
    ));

  if (!subscription) {
    return null;
  }
  if (subscription.currentPeriodEnd === null) {
    return { subscription, endsAt: perpetualSubscriptionEndsAt };
  }

  const endsAt = Date.parse(subscription.currentPeriodEnd);
  return endsAt > args.now ? { subscription, endsAt } : null;
});

/** Lifts one Convex read or write into the typed start failure channel. */
function tryAccessPromise<A>(operation: () => Promise<A>) {
  return Effect.tryPromise({ catch: toTryoutStartError, try: operation });
}
