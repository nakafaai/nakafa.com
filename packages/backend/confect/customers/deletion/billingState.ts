import {
  DatabaseReader,
  DatabaseWriter,
  MutationRunner,
} from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  CustomerSyncIoError,
  customerSyncIoError,
  customerSyncIoErrorCode,
} from "@repo/backend/confect/customers/sync/spec";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  ActionCtx,
  MutationCtx,
} from "@repo/backend/convex/_generated/server";
import { Effect, flow } from "effect";

const CUSTOMER_SUBSCRIPTION_CLEANUP_BATCH_SIZE = 50;
function toCustomerDeletionError(error: unknown) {
  return customerSyncIoError("Failed to delete local customer data", error);
}

/** Creates or binds the permanent Polar tombstone used by local cleanup. */
export const recordCustomerDeletionCheckpointProgram = Effect.fn(
  "customers.deletion.recordCustomerDeletionCheckpoint"
)(
  function* (
    ctx: MutationCtx,
    polarCustomerId: string,
    cleanupUserId?: Id<"users">
  ) {
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    const writer = DatabaseWriter.make(databaseSchema, ctx.db);
    const [customerCheckpoint, polarTombstone] = yield* Effect.all(
      [
        cleanupUserId
          ? database
              .table("customerDeletionTombstones")
              .get("by_cleanupUserId", cleanupUserId)
              .pipe(
                Effect.catchTag("GetByIndexFailure", () =>
                  Effect.succeed(null)
                ),
                Effect.orDie
              )
          : Effect.succeed(null),
        database
          .table("customerDeletionTombstones")
          .get("by_polarCustomerId", polarCustomerId)
          .pipe(
            Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
            Effect.orDie
          ),
      ],
      {
        concurrency: "unbounded",
      }
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
        yield* writer
          .table("customerDeletionTombstones")
          .patch(polarTombstone._id, {
            cleanupUserId,
          })
          .pipe(Effect.orDie);
      }
      return;
    }
    yield* writer
      .table("customerDeletionTombstones")
      .insert({
        ...(cleanupUserId === undefined
          ? {}
          : {
              cleanupUserId,
            }),
        polarCustomerId,
      })
      .pipe(Effect.orDie);
  },
  Effect.catchDefect(flow(toCustomerDeletionError, Effect.fail))
);

/** Deletes local subscriptions before their customer-to-user mapping. */
export const deleteCustomerByIdProgram = Effect.fn(
  "customers.deletion.deleteCustomerById"
)(
  function* (ctx: MutationCtx, polarCustomerId: string) {
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    const writer = DatabaseWriter.make(databaseSchema, ctx.db);
    yield* recordCustomerDeletionCheckpointProgram(ctx, polarCustomerId);
    const subscriptions = yield* database
      .table("subscriptions")
      .index("by_customerId_and_status", (query) =>
        query.eq("customerId", polarCustomerId)
      )
      .take(CUSTOMER_SUBSCRIPTION_CLEANUP_BATCH_SIZE)
      .pipe(Effect.orDie);
    for (const subscription of subscriptions) {
      yield* writer.table("subscriptions").delete(subscription._id);
    }
    if (subscriptions.length === CUSTOMER_SUBSCRIPTION_CLEANUP_BATCH_SIZE) {
      return true;
    }
    const customer = yield* database
      .table("customers")
      .get("by_polarId", polarCustomerId)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (customer) {
      yield* writer.table("customers").delete(customer._id);
    }
    return false;
  },
  Effect.catchDefect(flow(toCustomerDeletionError, Effect.fail))
);

/** Releases the deleted-user lookup after every local billing row is drained. */
export const completeCustomerDeletionCheckpointProgram = Effect.fn(
  "customers.deletion.completeCustomerDeletionCheckpoint"
)(
  function* (ctx: MutationCtx, userId: Id<"users">, polarCustomerId: string) {
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    const writer = DatabaseWriter.make(databaseSchema, ctx.db);
    const tombstone = yield* database
      .table("customerDeletionTombstones")
      .get("by_cleanupUserId", userId)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
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
    yield* writer
      .table("customerDeletionTombstones")
      .patch(tombstone._id, {
        cleanupUserId: undefined,
      })
      .pipe(Effect.orDie);
  },
  Effect.catchDefect(flow(toCustomerDeletionError, Effect.fail))
);

/** Drains every bounded local billing row for one Polar customer ID. */
export const deleteLocalCustomer: (
  ctx: ActionCtx,
  polarCustomerId: string
) => Effect.Effect<null, CustomerSyncIoError> = Effect.fn(
  "customers.deletion.deleteLocalCustomer"
)(function* (ctx: ActionCtx, polarCustomerId: string) {
  const runMutation = yield* MutationRunner.MutationRunner.pipe(
    Effect.provide(MutationRunner.layer(ctx.runMutation))
  );
  let hasMore = true;
  while (hasMore) {
    hasMore = yield* runMutation(
      refs.internal.customers.mutations.internal.deleteCustomerById,
      {
        id: polarCustomerId,
      }
    ).pipe(
      Effect.mapError((error) =>
        customerSyncIoError("Failed to delete local customer row", error)
      ),
      Effect.catchDefect(
        flow(
          (error) =>
            customerSyncIoError("Failed to delete local customer row", error),
          Effect.fail
        )
      )
    );
  }
  return null;
});
