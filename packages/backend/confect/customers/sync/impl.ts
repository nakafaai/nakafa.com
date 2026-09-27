import { MutationRunner, QueryRunner } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import { isAccountDeletionPending } from "@repo/backend/confect/auth/deletion/state";
import { deleteLocalCustomer } from "@repo/backend/confect/customers/deletion/billingState";
import type { CustomerUpsertResult } from "@repo/backend/confect/customers/mutations/spec";
import {
  ensureCustomer,
  normalizeStoredCustomer,
} from "@repo/backend/confect/customers/polar/impl";
import { polarGateway } from "@repo/backend/confect/customers/polar/live";
import {
  customerIdMetadataKey,
  type PolarCustomerEmailConflict,
  type PolarCustomerError,
  type PolarDeleteError,
  type PolarMetadata,
  type PolarUpdateError,
} from "@repo/backend/confect/customers/polar/spec";
import { convertToDatabaseCustomer } from "@repo/backend/confect/customers/records";
import { settleCustomerSync } from "@repo/backend/confect/customers/sync/settlement";
import {
  type CustomerSyncIoError,
  customerSyncIoError,
  UserNotFound,
  userNotFoundCode,
} from "@repo/backend/confect/customers/sync/spec";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import type { WithoutSystemFields } from "convex/server";
import { Effect, flow } from "effect";

type CustomerSyncUser = Pick<
  Doc<"users">,
  "_id" | "authId" | "deletedAt" | "deletionPreparedAt" | "email" | "name"
>;
type CustomerSyncState = [CustomerSyncUser | null, Doc<"customers"> | null];
type CustomerSyncError =
  | CustomerSyncIoError
  | PolarCustomerEmailConflict
  | PolarCustomerError
  | PolarDeleteError
  | UserNotFound
  | PolarUpdateError;
type RequiredCustomerError = CustomerSyncError;
export type RequiredCustomer = WithoutSystemFields<Doc<"customers">> & {
  readonly localCustomerId: Id<"customers">;
};

/** Loads the app user and any already-linked local customer row. */
const loadCustomerSyncState: (
  ctx: ActionCtx,
  userId: Id<"users">
) => Effect.Effect<CustomerSyncState, CustomerSyncIoError> = Effect.fn(
  "customers.sync.loadCustomerSyncState"
)(function* (ctx: ActionCtx, userId: Id<"users">) {
  const runQuery = yield* QueryRunner.QueryRunner.pipe(
    Effect.provide(QueryRunner.layer(ctx.runQuery))
  );
  return yield* Effect.all([
    runQuery(refs.internal.users.queries.getUserById, { userId }),
    runQuery(
      refs.internal.customers.queries.internal.customer.getCustomerByUserId,
      { userId }
    ),
  ]).pipe(
    Effect.mapError((error) =>
      customerSyncIoError("Failed to load local customer sync state", error)
    ),
    Effect.catchDefect(
      flow(
        (error) =>
          customerSyncIoError(
            "Failed to load local customer sync state",
            error
          ),
        Effect.fail
      )
    )
  );
});

/** Upserts the local customer row after Polar has been reconciled. */
const saveLocalCustomer: (
  ctx: ActionCtx,
  customer: WithoutSystemFields<Doc<"customers">>
) => Effect.Effect<CustomerUpsertResult, CustomerSyncIoError> = Effect.fn(
  "customers.sync.saveLocalCustomer"
)(function* (ctx: ActionCtx, customer: WithoutSystemFields<Doc<"customers">>) {
  const runMutation = yield* MutationRunner.MutationRunner.pipe(
    Effect.provide(MutationRunner.layer(ctx.runMutation))
  );
  return yield* runMutation(
    refs.internal.customers.mutations.internal.upsertCustomer,
    {
      customer,
    }
  ).pipe(
    Effect.mapError((error) =>
      customerSyncIoError("Failed to save local customer row", error)
    ),
    Effect.catchDefect(
      flow(
        (error) =>
          customerSyncIoError("Failed to save local customer row", error),
        Effect.fail
      )
    )
  );
});

/**
 * Reconciles Polar and local customer state for a known app user document.
 */
export const syncCustomerForUser: (
  ctx: ActionCtx,
  input: {
    readonly localCustomerId?: string | null;
    readonly user: CustomerSyncUser;
  }
) => Effect.Effect<RequiredCustomer, CustomerSyncError> = Effect.fn(
  "customers.sync.syncCustomerForUser"
)(function* (
  ctx: ActionCtx,
  input: {
    readonly localCustomerId?: string | null;
    readonly user: CustomerSyncUser;
  }
) {
  const metadata: PolarMetadata = {
    [customerIdMetadataKey]: input.user._id,
  };
  const polarCustomer = yield* ensureCustomer(polarGateway, {
    ...(input.localCustomerId === null || input.localCustomerId === undefined
      ? {}
      : {
          localCustomerId: input.localCustomerId,
        }),
    externalId: input.user.authId,
    email: input.user.email,
    name: input.user.name,
    metadata,
  });
  let syncedPolarCustomer = polarCustomer;
  if (Object.keys(polarCustomer.metadata).length === 0) {
    const updatedCustomer = yield* polarGateway.updateCustomerMetadata({
      polarCustomerId: polarCustomer.id,
      metadata,
    });
    syncedPolarCustomer = yield* normalizeStoredCustomer(updatedCustomer);
  }
  const customer = convertToDatabaseCustomer({
    ...syncedPolarCustomer,
    userId: input.user._id,
  });
  const result = yield* saveLocalCustomer(ctx, customer);
  const localCustomerId = yield* settleCustomerSync(result, input.user._id, {
    deleteLocalCustomer: () => deleteLocalCustomer(ctx, syncedPolarCustomer.id),
    deletePolarCustomer: () =>
      polarGateway.deleteCustomer(syncedPolarCustomer.id),
  });
  return {
    ...customer,
    localCustomerId,
  } satisfies RequiredCustomer;
});

/** Reconciles customer data for a user id, returning null when the user vanished. */
export const syncOptionalCustomer: (
  ctx: ActionCtx,
  userId: Id<"users">
) => Effect.Effect<RequiredCustomer | null, CustomerSyncError> = Effect.fn(
  "customers.sync.syncOptionalCustomer"
)(function* (ctx: ActionCtx, userId: Id<"users">) {
  const [user, localCustomer] = yield* loadCustomerSyncState(ctx, userId);
  if (!user || isAccountDeletionPending(user)) {
    return null;
  }
  return yield* syncCustomerForUser(ctx, {
    ...(localCustomer?.id === undefined
      ? {}
      : {
          localCustomerId: localCustomer?.id,
        }),
    user,
  }).pipe(Effect.catchTag("UserNotFound", () => Effect.succeed(null)));
});

/** Reconciles and returns the customer for an authenticated app user. */
export const requireCustomer: (
  ctx: ActionCtx,
  userId: Id<"users">
) => Effect.Effect<RequiredCustomer, RequiredCustomerError> = Effect.fn(
  "customers.sync.requireCustomer"
)(function* (ctx: ActionCtx, userId: Id<"users">) {
  const [user, localCustomer] = yield* loadCustomerSyncState(ctx, userId);
  if (!user || isAccountDeletionPending(user)) {
    return yield* new UserNotFound({
      code: userNotFoundCode,
      message: `User not found for userId: ${userId}`,
    });
  }
  return yield* syncCustomerForUser(ctx, {
    ...(localCustomer?.id === undefined
      ? {}
      : {
          localCustomerId: localCustomer?.id,
        }),
    user,
  });
});
