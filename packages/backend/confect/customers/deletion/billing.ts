import refs from "@repo/backend/confect/_generated/refs";
import {
  MutationRunner,
  QueryRunner,
} from "@repo/backend/confect/_generated/services";
import { deleteLocalCustomer } from "@repo/backend/confect/customers/deletion/billingState";
import { polarGateway } from "@repo/backend/confect/customers/polar/live";
import {
  CustomerSyncIoError,
  customerSyncIoError,
  customerSyncIoErrorCode,
} from "@repo/backend/confect/customers/sync/spec";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Effect } from "effect";

/** Deletes external and local billing state using a durable Polar identity. */
export const cleanupDeletedUserBilling = Effect.fn(
  "customers.deletion.cleanupDeletedUserBilling"
)(
  function* (userId: Id<"users">, authId: string) {
    const { runQuery } = yield* QueryRunner;
    const { runMutation } = yield* MutationRunner;
    const [customer, checkpointPolarCustomerId] = yield* Effect.all(
      [
        runQuery(
          refs.internal.customers.queries.internal.customer.getCustomerByUserId,
          {
            userId,
          }
        ),
        runQuery(
          refs.internal.customers.queries.internal.customer
            .getCustomerDeletionCheckpoint,
          {
            userId,
          }
        ),
      ],
      {
        concurrency: "unbounded",
      }
    ).pipe(Effect.orDie);
    if (
      checkpointPolarCustomerId &&
      customer &&
      checkpointPolarCustomerId !== customer.id
    ) {
      return yield* CustomerSyncIoError.make({
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
    yield* deleteLocalCustomer(polarCustomerId);
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
