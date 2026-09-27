import { DatabaseReader } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import type { TryoutStartScope } from "@repo/backend/confect/tryouts/start/spec";
import { toTryoutStartError } from "@repo/backend/confect/tryouts/start/spec";
import { products } from "@repo/backend/confect/utils/polar/products";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { Effect, flow, Option } from "effect";

const activeSubscriptionStatus = "active";
const perpetualSubscriptionEndsAt = Number.MAX_SAFE_INTEGER;
type TryoutAccessReadCtx = Pick<QueryCtx, "db">;

/** Loads one active Pro subscription through the user's Polar customer row. */
export const loadActiveProSubscription = Effect.fn(
  "tryouts.access.loadActiveProSubscription"
)(function* (ctx: TryoutAccessReadCtx, args: TryoutStartScope) {
  const database = DatabaseReader.make(databaseSchema, ctx.db);
  const customer = yield* database
    .table("customers")
    .get("by_userId", args.userId)
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.orDie,
      Effect.catchDefect(flow(toTryoutStartError, Effect.fail))
    );
  if (!customer) {
    return null;
  }
  const perpetual = yield* database
    .table("subscriptions")
    .index(
      "by_customerId_and_status_and_productId_and_currentPeriodEnd",
      (query) =>
        query
          .eq("customerId", customer.id)
          .eq("status", activeSubscriptionStatus)
          .eq("productId", products.pro.id)
          .eq("currentPeriodEnd", null)
    )
    .first()
    .pipe(
      Effect.map(Option.getOrNull),
      Effect.orDie,
      Effect.catchDefect(flow(toTryoutStartError, Effect.fail))
    );

  // Polar ingestion stores UTC ISO strings through Date.toISOString(), so
  // the period index excludes expired rows before reading a document.
  const subscription =
    perpetual ??
    (yield* database
      .table("subscriptions")
      .index(
        "by_customerId_and_status_and_productId_and_currentPeriodEnd",
        (query) =>
          query
            .eq("customerId", customer.id)
            .eq("status", activeSubscriptionStatus)
            .eq("productId", products.pro.id)
            .gt("currentPeriodEnd", new Date(args.now).toISOString())
      )
      .first()
      .pipe(
        Effect.map(Option.getOrNull),
        Effect.orDie,
        Effect.catchDefect(flow(toTryoutStartError, Effect.fail))
      ));
  if (!subscription) {
    return null;
  }
  if (subscription.currentPeriodEnd === null) {
    return {
      subscription,
      endsAt: perpetualSubscriptionEndsAt,
    };
  }
  const endsAt = Date.parse(subscription.currentPeriodEnd);
  return endsAt > args.now
    ? {
        subscription,
        endsAt,
      }
    : null;
});
