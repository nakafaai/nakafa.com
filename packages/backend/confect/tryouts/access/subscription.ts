import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import type { TryoutStartScope } from "@repo/backend/confect/tryouts/start/spec";
import { toTryoutStartError } from "@repo/backend/confect/tryouts/start/spec";
import { products } from "@repo/backend/confect/utils/polar/products";
import { DateTime, Effect, Option } from "effect";

const activeSubscriptionStatus = "active";
const perpetualSubscriptionEndsAt = Number.MAX_SAFE_INTEGER;

/** Loads one active Pro subscription through the user's Polar customer row. */
export const loadActiveProSubscription = Effect.fn(
  "tryouts.access.loadActiveProSubscription"
)(
  function* (args: TryoutStartScope) {
    const database = yield* DatabaseReader;
    const customer = yield* database
      .table("customers")
      .get("by_userId", args.userId)
      .pipe(Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)));
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
      .pipe(Effect.map(Option.getOrNull));

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
              .gt(
                "currentPeriodEnd",
                DateTime.formatIso(DateTime.makeUnsafe(args.now))
              )
        )
        .first()
        .pipe(Effect.map(Option.getOrNull)));
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
  },
  Effect.mapError(toTryoutStartError),
  Effect.catchDefect(() => Effect.fail(toTryoutStartError()))
);
