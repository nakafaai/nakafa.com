import type { Doc } from "@repo/backend/confect/_generated/dataModel";
import {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/confect/_generated/services";
import { requireAppUser } from "@repo/backend/confect/modules/identity/auth.service";
import { Effect } from "effect";

type SubscriptionFields = Omit<Doc<"subscriptions">, "_creationTime" | "_id">;

/** Creates a subscription unless the Polar subscription id already exists. */
export const createSubscription = Effect.fn("commerce.createSubscription")(
  function* (args: { subscription: SubscriptionFields }) {
    const ctx = yield* MutationCtx;
    const existingSubscription = yield* Effect.promise(() =>
      ctx.db
        .query("subscriptions")
        .withIndex("by_subscriptionId", (query) =>
          query.eq("id", args.subscription.id)
        )
        .unique()
    );

    if (existingSubscription) {
      return existingSubscription._id;
    }

    return yield* Effect.promise(() =>
      ctx.db.insert("subscriptions", args.subscription)
    );
  }
);

/** Upserts a subscription by Polar subscription id. */
export const updateSubscription = Effect.fn("commerce.updateSubscription")(
  function* (args: { subscription: SubscriptionFields }) {
    const ctx = yield* MutationCtx;
    const existingSubscription = yield* Effect.promise(() =>
      ctx.db
        .query("subscriptions")
        .withIndex("by_subscriptionId", (query) =>
          query.eq("id", args.subscription.id)
        )
        .unique()
    );

    if (!existingSubscription) {
      yield* Effect.promise(() =>
        ctx.db.insert("subscriptions", args.subscription)
      );
      return null;
    }

    yield* Effect.promise(() =>
      ctx.db.patch(existingSubscription._id, args.subscription)
    );
    return null;
  }
);

/** Returns whether the current user has an active subscription for a product. */
export const hasActiveSubscription = Effect.fn(
  "commerce.hasActiveSubscription"
)(function* (args: { productId: string }) {
  const ctx = yield* QueryCtx;
  const user = yield* requireAppUser(ctx);
  const customer = yield* Effect.promise(() =>
    ctx.db
      .query("customers")
      .withIndex("by_userId", (query) => query.eq("userId", user.appUser._id))
      .unique()
  );

  if (!customer) {
    return false;
  }

  const subscription = yield* Effect.promise(() =>
    ctx.db
      .query("subscriptions")
      .withIndex("by_customerId_and_status_and_productId", (query) =>
        query
          .eq("customerId", customer.id)
          .eq("status", "active")
          .eq("productId", args.productId)
      )
      .first()
  );

  return subscription !== null;
});

/** Subscription service accessors used by Confect function implementations. */
export class Subscriptions extends Effect.Service<Subscriptions>()(
  "Subscriptions",
  {
    accessors: true,
    succeed: {
      createSubscription,
      hasActiveSubscription,
      updateSubscription,
    },
  }
) {}
