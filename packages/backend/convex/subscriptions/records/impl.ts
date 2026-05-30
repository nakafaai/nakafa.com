import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { getUnknownErrorMessage } from "@repo/backend/convex/lib/effect";
import {
  type SubscriptionRecord,
  SubscriptionRecordIoError,
  subscriptionRecordIoFailedCode,
} from "@repo/backend/convex/subscriptions/records/spec";
import { Effect } from "effect";

/** Maps thrown Convex IO failures into the subscription record error channel. */
function toSubscriptionRecordIoError(error: unknown) {
  return new SubscriptionRecordIoError({
    code: subscriptionRecordIoFailedCode,
    message: getUnknownErrorMessage(error),
  });
}

/** Loads one stored subscription by its Polar subscription ID. */
const loadSubscriptionByPolarId = Effect.fn(
  "subscriptions.records.loadSubscriptionByPolarId"
)(function* (db: MutationCtx["db"], subscriptionId: SubscriptionRecord["id"]) {
  return yield* Effect.tryPromise({
    try: () =>
      db
        .query("subscriptions")
        .withIndex("by_subscriptionId", (q) => q.eq("id", subscriptionId))
        .unique(),
    catch: toSubscriptionRecordIoError,
  });
});

/**
 * Creates one subscription record idempotently for Polar webhook delivery.
 *
 * The caller must pass a trigger-aware mutation ctx so subscription inserts
 * still run the registered subscription trigger atomically.
 * @see https://github.com/get-convex/convex-helpers/blob/main/packages/convex-helpers/README.md#triggers
 * @see https://docs.convex.dev/functions/error-handling/
 */
export const createSubscriptionRecord = Effect.fn(
  "subscriptions.records.createSubscriptionRecord"
)(function* (ctx: MutationCtx, subscription: SubscriptionRecord) {
  const existingSubscription = yield* loadSubscriptionByPolarId(
    ctx.db,
    subscription.id
  );

  if (existingSubscription) {
    return existingSubscription._id;
  }

  return yield* Effect.tryPromise({
    try: () => ctx.db.insert("subscriptions", subscription),
    catch: toSubscriptionRecordIoError,
  });
});

/**
 * Updates one subscription record and creates it for out-of-order webhooks.
 *
 * The caller must pass a trigger-aware mutation ctx so subscription writes run
 * the registered trigger atomically with the webhook mutation.
 * @see https://github.com/get-convex/convex-helpers/blob/main/packages/convex-helpers/README.md#triggers
 * @see https://effect.website/docs/error-management/expected-errors/
 */
export const updateSubscriptionRecord = Effect.fn(
  "subscriptions.records.updateSubscriptionRecord"
)(function* (ctx: MutationCtx, subscription: SubscriptionRecord) {
  const existingSubscription = yield* loadSubscriptionByPolarId(
    ctx.db,
    subscription.id
  );

  if (!existingSubscription) {
    yield* Effect.tryPromise({
      try: () => ctx.db.insert("subscriptions", subscription),
      catch: toSubscriptionRecordIoError,
    });
    return null;
  }

  yield* Effect.tryPromise({
    try: () =>
      ctx.db.patch("subscriptions", existingSubscription._id, subscription),
    catch: toSubscriptionRecordIoError,
  });

  return null;
});
