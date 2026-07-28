import { internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { deleteLocalCustomer } from "@repo/backend/convex/customers/deletion/billingState";
import { polarGateway } from "@repo/backend/convex/customers/polar/live";
import type {
  PolarCustomerError,
  PolarDeleteError,
} from "@repo/backend/convex/customers/polar/spec";
import {
  CustomerSyncIoError,
  customerSyncIoError,
  customerSyncIoErrorCode,
} from "@repo/backend/convex/customers/sync/spec";
import { Effect } from "effect";

type DeletedUserBillingCleanupError =
  | CustomerSyncIoError
  | PolarCustomerError
  | PolarDeleteError;

/** Persists the Polar ID before an external deletion can make it undiscoverable. */
const recordCustomerDeletionCheckpoint = Effect.fn(
  "customers.deletion.recordCheckpoint"
)(function* (ctx: ActionCtx, userId: Id<"users">, polarCustomerId: string) {
  return yield* Effect.tryPromise({
    try: () =>
      ctx.runMutation(
        internal.customers.mutations.internal.recordCustomerDeletionCheckpoint,
        { polarCustomerId, userId }
      ),
    catch: (error) =>
      customerSyncIoError(
        "Failed to record customer deletion checkpoint",
        error
      ),
  });
});

/** Removes the retry lookup after external and local deletion both finish. */
const completeCustomerDeletionCheckpoint = Effect.fn(
  "customers.deletion.completeCheckpoint"
)(function* (ctx: ActionCtx, userId: Id<"users">, polarCustomerId: string) {
  return yield* Effect.tryPromise({
    try: () =>
      ctx.runMutation(
        internal.customers.mutations.internal
          .completeCustomerDeletionCheckpoint,
        { polarCustomerId, userId }
      ),
    catch: (error) =>
      customerSyncIoError(
        "Failed to complete customer deletion checkpoint",
        error
      ),
  });
});

/** Deletes Polar and local billing state for one deleted app user. */
export const cleanupDeletedUserBilling: (
  ctx: ActionCtx,
  userId: Id<"users">,
  authId: string
) => Effect.Effect<null, DeletedUserBillingCleanupError> = Effect.fn(
  "customers.deletion.cleanupDeletedUserBilling"
)(function* (ctx: ActionCtx, userId: Id<"users">, authId: string) {
  const [customer, checkpointPolarCustomerId] = yield* Effect.tryPromise({
    try: () =>
      Promise.all([
        ctx.runQuery(
          internal.customers.queries.internal.customer.getCustomerByUserId,
          { userId }
        ),
        ctx.runQuery(
          internal.customers.queries.internal.customer
            .getCustomerDeletionCheckpoint,
          { userId }
        ),
      ]),
    catch: (error) =>
      customerSyncIoError("Failed to load customer cleanup state", error),
  });

  if (
    checkpointPolarCustomerId &&
    customer &&
    checkpointPolarCustomerId !== customer.id
  ) {
    return yield* new CustomerSyncIoError({
      code: customerSyncIoErrorCode,
      message:
        "Customer cleanup state is inconsistent: local customer and durable checkpoint use different Polar IDs.",
    });
  }

  const polarCustomerId =
    checkpointPolarCustomerId ??
    customer?.id ??
    (yield* polarGateway.getCustomerByExternalId(authId))?.id;

  if (!polarCustomerId) {
    return null;
  }

  yield* recordCustomerDeletionCheckpoint(ctx, userId, polarCustomerId);
  yield* polarGateway.deleteCustomer(polarCustomerId);
  yield* deleteLocalCustomer(ctx, polarCustomerId);
  yield* completeCustomerDeletionCheckpoint(ctx, userId, polarCustomerId);

  return null;
});
