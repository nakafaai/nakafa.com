import { internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  ActionCtx,
  MutationCtx,
} from "@repo/backend/convex/_generated/server";
import {
  CustomerSyncIoError,
  customerSyncIoError,
  customerSyncIoErrorCode,
} from "@repo/backend/convex/customers/sync/spec";
import { Effect } from "effect";

const CUSTOMER_SUBSCRIPTION_CLEANUP_BATCH_SIZE = 50;

function tryCustomerDeletion<A>(operation: () => Promise<A>) {
  return Effect.tryPromise({
    catch: (error) =>
      customerSyncIoError("Failed to delete local customer data", error),
    try: operation,
  });
}

/** Creates or binds the permanent Polar tombstone used by local cleanup. */
export const recordCustomerDeletionCheckpointProgram = Effect.fn(
  "customers.deletion.recordCustomerDeletionCheckpoint"
)(function* (
  ctx: MutationCtx,
  polarCustomerId: string,
  cleanupUserId?: Id<"users">
) {
  const [customerCheckpoint, polarTombstone] = yield* tryCustomerDeletion(() =>
    Promise.all([
      cleanupUserId
        ? ctx.db
            .query("customerDeletionTombstones")
            .withIndex("by_cleanupUserId", (query) =>
              query.eq("cleanupUserId", cleanupUserId)
            )
            .unique()
        : Promise.resolve(null),
      ctx.db
        .query("customerDeletionTombstones")
        .withIndex("by_polarCustomerId", (query) =>
          query.eq("polarCustomerId", polarCustomerId)
        )
        .unique(),
    ])
  );

  if (
    customerCheckpoint &&
    customerCheckpoint.polarCustomerId !== polarCustomerId
  ) {
    return yield* new CustomerSyncIoError({
      code: customerSyncIoErrorCode,
      message:
        "Deleted-user billing cleanup already has a different Polar customer checkpoint.",
    });
  }

  if (polarTombstone) {
    if (
      cleanupUserId !== undefined &&
      polarTombstone.cleanupUserId !== cleanupUserId
    ) {
      yield* tryCustomerDeletion(() =>
        ctx.db.patch("customerDeletionTombstones", polarTombstone._id, {
          cleanupUserId,
        })
      );
    }
    return;
  }

  yield* tryCustomerDeletion(() =>
    ctx.db.insert("customerDeletionTombstones", {
      cleanupUserId,
      polarCustomerId,
    })
  );
});

/** Deletes local subscriptions before their customer-to-user mapping. */
export const deleteCustomerByIdProgram = Effect.fn(
  "customers.deletion.deleteCustomerById"
)(function* (ctx: MutationCtx, polarCustomerId: string) {
  yield* recordCustomerDeletionCheckpointProgram(ctx, polarCustomerId);

  const subscriptions = yield* tryCustomerDeletion(() =>
    ctx.db
      .query("subscriptions")
      .withIndex("by_customerId_and_status", (query) =>
        query.eq("customerId", polarCustomerId)
      )
      .take(CUSTOMER_SUBSCRIPTION_CLEANUP_BATCH_SIZE)
  );

  for (const subscription of subscriptions) {
    yield* tryCustomerDeletion(() =>
      ctx.db.delete("subscriptions", subscription._id)
    );
  }

  if (subscriptions.length === CUSTOMER_SUBSCRIPTION_CLEANUP_BATCH_SIZE) {
    return true;
  }

  const customer = yield* tryCustomerDeletion(() =>
    ctx.db
      .query("customers")
      .withIndex("by_polarId", (query) => query.eq("id", polarCustomerId))
      .unique()
  );

  if (customer) {
    yield* tryCustomerDeletion(() => ctx.db.delete("customers", customer._id));
  }

  return false;
});

/** Releases the deleted-user lookup after every local billing row is drained. */
export const completeCustomerDeletionCheckpointProgram = Effect.fn(
  "customers.deletion.completeCustomerDeletionCheckpoint"
)(function* (ctx: MutationCtx, userId: Id<"users">, polarCustomerId: string) {
  const tombstone = yield* tryCustomerDeletion(() =>
    ctx.db
      .query("customerDeletionTombstones")
      .withIndex("by_cleanupUserId", (query) =>
        query.eq("cleanupUserId", userId)
      )
      .unique()
  );

  if (!tombstone) {
    return;
  }

  if (tombstone.polarCustomerId !== polarCustomerId) {
    return yield* new CustomerSyncIoError({
      code: customerSyncIoErrorCode,
      message:
        "Deleted-user billing cleanup checkpoint changed before completion.",
    });
  }

  yield* tryCustomerDeletion(() =>
    ctx.db.patch("customerDeletionTombstones", tombstone._id, {
      cleanupUserId: undefined,
    })
  );
});

/** Drains every bounded local billing row for one Polar customer ID. */
export const deleteLocalCustomer: (
  ctx: ActionCtx,
  polarCustomerId: string
) => Effect.Effect<null, CustomerSyncIoError> = Effect.fn(
  "customers.deletion.deleteLocalCustomer"
)(function* (ctx: ActionCtx, polarCustomerId: string) {
  let hasMore = true;

  while (hasMore) {
    hasMore = yield* Effect.tryPromise({
      try: () =>
        ctx.runMutation(
          internal.customers.mutations.internal.deleteCustomerById,
          { id: polarCustomerId }
        ),
      catch: (error) =>
        customerSyncIoError("Failed to delete local customer row", error),
    });
  }

  return null;
});
