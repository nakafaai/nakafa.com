import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { getUnknownErrorMessage } from "@repo/backend/confect/failure";
import {
  type SubscriptionRecord,
  SubscriptionRecordIoError,
  subscriptionRecordIoFailedCode,
} from "@repo/backend/confect/subscriptions/records/spec";
import { Effect, flow } from "effect";

/** Maps thrown Convex IO failures into the subscription record error channel. */
function toSubscriptionRecordIoError(error: unknown) {
  return SubscriptionRecordIoError.make({
    code: subscriptionRecordIoFailedCode,
    message: getUnknownErrorMessage(error),
  });
}

/** Loads one stored subscription by its Polar subscription ID. */
const loadSubscriptionByPolarId = Effect.fn(
  "subscriptions.records.loadSubscriptionByPolarId"
)(function* (subscriptionId: SubscriptionRecord["id"]) {
  const database = yield* DatabaseReader;
  return yield* database
    .table("subscriptions")
    .get("by_subscriptionId", subscriptionId)
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
});

/** Loads the terminal customer-deletion marker for a Polar customer ID. */
const loadCustomerDeletionTombstone = Effect.fn(
  "subscriptions.records.loadCustomerDeletionTombstone"
)(function* (polarCustomerId: string) {
  const database = yield* DatabaseReader;
  return yield* database
    .table("customerDeletionTombstones")
    .get("by_polarCustomerId", polarCustomerId)
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
});

/**
 * Discards any stale row after its Polar customer reached terminal deletion.
 */
const discardSubscriptionForDeletedCustomer = Effect.fn(
  "subscriptions.records.discardSubscriptionForDeletedCustomer"
)(function* (
  subscription: SubscriptionRecord,
  existingSubscription: Docs["subscriptions"] | null
) {
  const writer = yield* DatabaseWriter;
  const tombstone = yield* loadCustomerDeletionTombstone(
    subscription.customerId
  );
  if (!tombstone) {
    return false;
  }
  if (existingSubscription) {
    yield* writer.table("subscriptions").delete(existingSubscription._id);
  }
  return true;
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
)(
  function* (subscription: SubscriptionRecord) {
    const writer = yield* DatabaseWriter;
    const existingSubscription = yield* loadSubscriptionByPolarId(
      subscription.id
    );
    if (
      yield* discardSubscriptionForDeletedCustomer(
        subscription,
        existingSubscription
      )
    ) {
      return null;
    }
    if (existingSubscription) {
      return existingSubscription._id;
    }
    return yield* writer
      .table("subscriptions")
      .insert(subscription)
      .pipe(Effect.orDie);
  },
  Effect.catchDefect(flow(toSubscriptionRecordIoError, Effect.fail))
);

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
)(
  function* (subscription: SubscriptionRecord) {
    const writer = yield* DatabaseWriter;
    const existingSubscription = yield* loadSubscriptionByPolarId(
      subscription.id
    );
    if (
      yield* discardSubscriptionForDeletedCustomer(
        subscription,
        existingSubscription
      )
    ) {
      return null;
    }
    if (!existingSubscription) {
      yield* writer
        .table("subscriptions")
        .insert(subscription)
        .pipe(Effect.orDie);
      return null;
    }
    yield* writer
      .table("subscriptions")
      .patch(existingSubscription._id, subscription)
      .pipe(Effect.orDie);
    return null;
  },
  Effect.catchDefect(flow(toSubscriptionRecordIoError, Effect.fail))
);
