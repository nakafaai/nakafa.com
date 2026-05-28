import type { Id } from "@repo/backend/confect/_generated/dataModel";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { readPolarServer } from "@repo/backend/confect/modules/commerce/polar/env";
import { getProductsForServer } from "@repo/backend/confect/modules/commerce/polar/products";
import {
  type TryoutProduct,
  tryoutProducts,
} from "@repo/backend/confect/modules/tryout/products";
import { TryoutError } from "@repo/backend/confect/modules/tryout/tryout.errors";
import { Effect, Option } from "effect";

const getTryoutPaidProductIds = Effect.fn("tryouts.subscriptions.productIds")(
  function* () {
    const server = yield* readPolarServer();
    const products = getProductsForServer(server);

    return {
      snbt: products.pro.id,
    } as const;
  }
);

/** Parses an optional ISO subscription timestamp. */
function parseSubscriptionTimestamp(value: string | null, fieldName: string) {
  if (!value) {
    return Effect.succeed(null);
  }

  const parsedValue = Date.parse(value);

  if (!Number.isNaN(parsedValue)) {
    return Effect.succeed(parsedValue);
  }

  return Effect.fail(
    new TryoutError({
      code: "INVALID_SUBSCRIPTION_WINDOW",
      message: `Subscription ${fieldName} must be a valid ISO timestamp.`,
    })
  );
}

/** Loads the perpetual active subscription for one Polar product. */
const getPerpetualActiveSubscriptionForProduct = Effect.fn(
  "tryouts.subscriptions.getPerpetualActiveSubscriptionForProduct"
)(function* (args: {
  readonly customerId: string;
  readonly productId: string;
}) {
  const reader = yield* DatabaseReader;

  return yield* reader
    .table("subscriptions")
    .index(
      "by_customerId_and_status_and_productId_and_currentPeriodEnd",
      (query) =>
        query
          .eq("customerId", args.customerId)
          .eq("status", "active")
          .eq("productId", args.productId)
          .eq("currentPeriodEnd", null)
    )
    .first()
    .pipe(Effect.map(Option.getOrNull));
});

/** Loads the latest active subscription for one Polar product. */
export const getLatestActiveSubscriptionForProduct = Effect.fn(
  "tryouts.subscriptions.getLatestActiveSubscriptionForProduct"
)(function* (args: {
  readonly customerId: string;
  readonly productId: string;
}) {
  const perpetualSubscription =
    yield* getPerpetualActiveSubscriptionForProduct(args);

  if (perpetualSubscription) {
    return perpetualSubscription;
  }

  const reader = yield* DatabaseReader;

  return yield* reader
    .table("subscriptions")
    .index(
      "by_customerId_and_status_and_productId_and_currentPeriodEnd",
      (query) =>
        query
          .eq("customerId", args.customerId)
          .eq("status", "active")
          .eq("productId", args.productId)
    )
    .first()
    .pipe(Effect.map(Option.getOrNull));
});

/** Lists canonical active tryout subscriptions for a Polar customer. */
export const listCanonicalActiveTryoutSubscriptions = Effect.fn(
  "tryouts.subscriptions.listCanonicalActiveTryoutSubscriptions"
)(function* (args: { readonly customerId: string }) {
  const tryoutPaidProductIds = yield* getTryoutPaidProductIds();
  const subscriptions = yield* Effect.all(
    tryoutProducts.map((product) =>
      getLatestActiveSubscriptionForProduct({
        customerId: args.customerId,
        productId: tryoutPaidProductIds[product],
      })
    )
  );

  return subscriptions.filter((subscription) => subscription !== null);
});

/** Resolves an active paid subscription for a tryout user/product pair. */
export const getActiveTryoutSubscriptionForUserProduct = Effect.fn(
  "tryouts.subscriptions.getActiveTryoutSubscriptionForUserProduct"
)(function* (args: {
  readonly now: number;
  readonly product: TryoutProduct;
  readonly userId: Id<"users">;
}) {
  const reader = yield* DatabaseReader;
  const customer = yield* reader
    .table("customers")
    .index("by_userId", (query) => query.eq("userId", args.userId))
    .first()
    .pipe(Effect.map(Option.getOrNull));

  if (!customer) {
    return null;
  }

  const tryoutPaidProductIds = yield* getTryoutPaidProductIds();
  const subscription = yield* getLatestActiveSubscriptionForProduct({
    customerId: customer.id,
    productId: tryoutPaidProductIds[args.product],
  });

  if (!subscription) {
    return null;
  }

  const startsAt = yield* parseSubscriptionTimestamp(
    subscription.currentPeriodStart,
    "currentPeriodStart"
  );

  if (startsAt === null || startsAt > args.now) {
    return null;
  }

  const parsedEndsAt = yield* parseSubscriptionTimestamp(
    subscription.currentPeriodEnd,
    "currentPeriodEnd"
  );
  const endsAt = parsedEndsAt ?? Number.MAX_SAFE_INTEGER;

  if (endsAt <= args.now) {
    return null;
  }

  return {
    endsAt,
    startsAt,
    subscriptionId: subscription._id,
  };
});
