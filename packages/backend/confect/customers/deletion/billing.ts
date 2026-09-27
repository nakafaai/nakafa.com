import { MutationRunner, QueryRunner } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import { deleteLocalCustomer } from "@repo/backend/confect/customers/deletion/billingState";
import { polarGateway } from "@repo/backend/confect/customers/polar/live";
import type {
  PolarCustomerError,
  PolarDeleteError,
} from "@repo/backend/confect/customers/polar/spec";
import {
  CustomerSyncIoError,
  customerSyncIoError,
  customerSyncIoErrorCode,
} from "@repo/backend/confect/customers/sync/spec";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { Effect } from "effect";

type DeletedUserBillingCleanupError =
  | CustomerSyncIoError
  | PolarCustomerError
  | PolarDeleteError;

/** Deletes external and local billing state using a durable Polar identity. */
export const cleanupDeletedUserBilling: (
  ctx: ActionCtx,
  userId: Id<"users">,
  authId: string
) => Effect.Effect<null, DeletedUserBillingCleanupError> = Effect.fn(
  "customers.deletion.cleanupDeletedUserBilling"
)(
  function* (ctx: ActionCtx, userId: Id<"users">, authId: string) {
    const runQuery = yield* QueryRunner.QueryRunner.pipe(
      Effect.provide(QueryRunner.layer(ctx.runQuery))
    );
    const runMutation = yield* MutationRunner.MutationRunner.pipe(
      Effect.provide(MutationRunner.layer(ctx.runMutation))
    );
    const [customer, checkpointPolarCustomerId] = yield* Effect.all(
      [
        runQuery(
          refs.internal.customers.queries.internal.customer.getCustomerByUserId,
          { userId }
        ),
        runQuery(
          refs.internal.customers.queries.internal.customer
            .getCustomerDeletionCheckpoint,
          { userId }
        ),
      ],
      { concurrency: "unbounded" }
    ).pipe(Effect.orDie);
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
    // Preserve the external identity before Polar deletion makes it undiscoverable.
    yield* runMutation(
      refs.internal.customers.mutations.internal
        .recordCustomerDeletionCheckpoint,
      {
        userId,
        polarCustomerId,
      }
    ).pipe(Effect.catchTag("SchemaError", Effect.die));
    yield* polarGateway.deleteCustomer(polarCustomerId);
    yield* deleteLocalCustomer(ctx, polarCustomerId);
    // Release only the retry lookup after both external and local deletion finish.
    yield* runMutation(
      refs.internal.customers.mutations.internal
        .completeCustomerDeletionCheckpoint,
      {
        userId,
        polarCustomerId,
      }
    ).pipe(Effect.catchTag("SchemaError", Effect.die));
    return null;
  },
  Effect.catchDefect((error) =>
    Effect.fail(
      customerSyncIoError("Failed to clean up deleted customer billing", error)
    )
  )
);
