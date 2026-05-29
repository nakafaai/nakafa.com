import { internal } from "@repo/backend/convex/_generated/api";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import {
  ensureCustomer,
  normalizeStoredCustomer,
} from "@repo/backend/convex/customers/polar/impl";
import { polarGateway } from "@repo/backend/convex/customers/polar/live";
import {
  customerIdMetadataKey,
  type PolarCustomerEmailConflict,
  type PolarCustomerError,
  type PolarDeleteError,
  type PolarMetadata,
  type PolarUpdateError,
} from "@repo/backend/convex/customers/polar/spec";
import { convertToDatabaseCustomer } from "@repo/backend/convex/customers/records";
import {
  CustomerExternalIdInUse,
  CustomerHasActiveSubscription,
  CustomerNotOrphaned,
  CustomerSyncIoError,
  customerExternalIdInUseCode,
  customerHasActiveSubscriptionCode,
  customerNotOrphanedCode,
  customerSyncIoErrorCode,
  type RepairCustomerResult,
  UserNotFound,
  userNotFoundCode,
} from "@repo/backend/convex/customers/sync/spec";
import { getUnknownErrorMessage } from "@repo/backend/convex/lib/effect";
import type { WithoutSystemFields } from "convex/server";
import { Effect } from "effect";

type CustomerSyncUser = Pick<Doc<"users">, "_id" | "authId" | "email" | "name">;
type CustomerSyncState = [CustomerSyncUser | null, Doc<"customers"> | null];
type CustomerSyncError =
  | CustomerSyncIoError
  | PolarCustomerEmailConflict
  | PolarCustomerError
  | PolarUpdateError;
type RequiredCustomerError = CustomerSyncError | UserNotFound;
type CleanupUserDataError = CustomerSyncIoError | PolarDeleteError;
type CleanupStalePolarCustomerError =
  | CleanupUserDataError
  | CustomerExternalIdInUse
  | CustomerHasActiveSubscription
  | CustomerNotOrphaned;

export type RequiredCustomer = WithoutSystemFields<Doc<"customers">> & {
  readonly localCustomerId: Id<"customers">;
};

function customerSyncIoError(message: string, error: unknown) {
  return new CustomerSyncIoError({
    code: customerSyncIoErrorCode,
    message: `${message}: ${getUnknownErrorMessage(error)}`,
  });
}

/** Loads the app user and any already-linked local customer row. */
const loadCustomerSyncState: (
  ctx: ActionCtx,
  userId: Id<"users">
) => Effect.Effect<CustomerSyncState, CustomerSyncIoError> = Effect.fn(
  "customers.sync.loadCustomerSyncState"
)(function* (ctx: ActionCtx, userId: Id<"users">) {
  return yield* Effect.tryPromise({
    try: async () => {
      const [user, localCustomer] = await Promise.all([
        ctx.runQuery(internal.users.queries.getUserById, { userId }),
        ctx.runQuery(
          internal.customers.queries.internal.customer.getCustomerByUserId,
          {
            userId,
          }
        ),
      ]);
      return [user, localCustomer] satisfies CustomerSyncState;
    },
    catch: (error) =>
      customerSyncIoError("Failed to load local customer sync state", error),
  });
});

/** Upserts the local customer row after Polar has been reconciled. */
const saveLocalCustomer: (
  ctx: ActionCtx,
  customer: WithoutSystemFields<Doc<"customers">>
) => Effect.Effect<Id<"customers">, CustomerSyncIoError> = Effect.fn(
  "customers.sync.saveLocalCustomer"
)(function* (ctx: ActionCtx, customer: WithoutSystemFields<Doc<"customers">>) {
  return yield* Effect.tryPromise({
    try: () =>
      ctx.runMutation(internal.customers.mutations.internal.upsertCustomer, {
        customer,
      }),
    catch: (error) =>
      customerSyncIoError("Failed to save local customer row", error),
  });
});

/** Deletes the local customer row linked to one Polar customer ID. */
const deleteLocalCustomer: (
  ctx: ActionCtx,
  polarCustomerId: string
) => Effect.Effect<null, CustomerSyncIoError> = Effect.fn(
  "customers.sync.deleteLocalCustomer"
)(function* (ctx: ActionCtx, polarCustomerId: string) {
  return yield* Effect.tryPromise({
    try: () =>
      ctx.runMutation(
        internal.customers.mutations.internal.deleteCustomerById,
        {
          id: polarCustomerId,
        }
      ),
    catch: (error) =>
      customerSyncIoError("Failed to delete local customer row", error),
  });
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
    localCustomerId: input.localCustomerId ?? undefined,
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
  const localCustomerId = yield* saveLocalCustomer(ctx, customer);

  return { ...customer, localCustomerId } satisfies RequiredCustomer;
});

/** Reconciles customer data for a user id, returning null when the user vanished. */
export const syncOptionalCustomer: (
  ctx: ActionCtx,
  userId: Id<"users">
) => Effect.Effect<RequiredCustomer | null, CustomerSyncError> = Effect.fn(
  "customers.sync.syncOptionalCustomer"
)(function* (ctx: ActionCtx, userId: Id<"users">) {
  const [user, localCustomer] = yield* loadCustomerSyncState(ctx, userId);

  if (!user) {
    return null;
  }

  return yield* syncCustomerForUser(ctx, {
    localCustomerId: localCustomer?.id,
    user,
  });
});

/** Reconciles and returns the customer for an authenticated app user. */
export const requireCustomer: (
  ctx: ActionCtx,
  userId: Id<"users">
) => Effect.Effect<RequiredCustomer, RequiredCustomerError> = Effect.fn(
  "customers.sync.requireCustomer"
)(function* (ctx: ActionCtx, userId: Id<"users">) {
  const [user, localCustomer] = yield* loadCustomerSyncState(ctx, userId);

  if (!user) {
    return yield* Effect.fail(
      new UserNotFound({
        code: userNotFoundCode,
        message: `User not found for userId: ${userId}`,
      })
    );
  }

  return yield* syncCustomerForUser(ctx, {
    localCustomerId: localCustomer?.id,
    user,
  });
});

/** Repairs one user's customer mapping and reports duplicate-email conflicts. */
export const repairCustomerMapping: (
  ctx: ActionCtx,
  userId: Id<"users">
) => Effect.Effect<
  RepairCustomerResult,
  CustomerSyncIoError | PolarCustomerError | PolarUpdateError | UserNotFound
> = Effect.fn("customers.sync.repairCustomerMapping")(function* (
  ctx: ActionCtx,
  userId: Id<"users">
) {
  return yield* requireCustomer(ctx, userId).pipe(
    Effect.map((customer) => ({
      localCustomerId: customer.localCustomerId,
      status: "synced" as const,
    })),
    Effect.catchTag("PolarCustomerEmailConflict", (conflict) =>
      Effect.succeed({
        existingExternalId: conflict.existingExternalId,
        polarCustomerId: conflict.polarCustomerId,
        status: "conflict" as const,
      })
    )
  );
});

/** Deletes Polar and local customer state for a deleted app user. */
export const cleanupCustomerDataForDeletedUser: (
  ctx: ActionCtx,
  userId: Id<"users">
) => Effect.Effect<null, CleanupUserDataError> = Effect.fn(
  "customers.sync.cleanupCustomerDataForDeletedUser"
)(function* (ctx: ActionCtx, userId: Id<"users">) {
  const customer = yield* Effect.tryPromise({
    try: () =>
      ctx.runQuery(
        internal.customers.queries.internal.customer.getCustomerByUserId,
        {
          userId,
        }
      ),
    catch: (error) =>
      customerSyncIoError("Failed to load customer for cleanup", error),
  });

  if (!customer) {
    return null;
  }

  yield* polarGateway.deleteCustomer(customer.id);
  yield* deleteLocalCustomer(ctx, customer.id);

  return null;
});

/**
 * Deletes one stale Polar customer after proving no user or active subscription
 * still depends on it.
 */
export const cleanupOrphanedPolarCustomer: (
  ctx: ActionCtx,
  input: {
    readonly existingExternalId: string | null;
    readonly polarCustomerId: string;
  }
) => Effect.Effect<null, CleanupStalePolarCustomerError> = Effect.fn(
  "customers.sync.cleanupOrphanedPolarCustomer"
)(function* (
  ctx: ActionCtx,
  input: {
    readonly existingExternalId: string | null;
    readonly polarCustomerId: string;
  }
) {
  const customer = yield* Effect.tryPromise({
    try: () =>
      ctx.runQuery(
        internal.customers.queries.internal.customer.getCustomerByPolarId,
        {
          polarCustomerId: input.polarCustomerId,
        }
      ),
    catch: (error) =>
      customerSyncIoError("Failed to load stale Polar customer", error),
  });

  if (!customer) {
    return null;
  }

  const [user, authUser, hasActiveSubscription] = yield* Effect.tryPromise({
    try: () =>
      Promise.all([
        ctx.runQuery(internal.users.queries.getUserById, {
          userId: customer.userId,
        }),
        input.existingExternalId
          ? ctx.runQuery(internal.users.queries.getUserByAuthId, {
              authId: input.existingExternalId,
            })
          : Promise.resolve(null),
        ctx.runQuery(
          internal.customers.queries.internal.customer
            .hasActiveSubscriptionByCustomerId,
          {
            customerId: input.polarCustomerId,
          }
        ),
      ]),
    catch: (error) =>
      customerSyncIoError("Failed to validate stale Polar customer", error),
  });

  if (user) {
    return yield* Effect.fail(
      new CustomerNotOrphaned({
        code: customerNotOrphanedCode,
        message:
          "Cannot delete a Polar customer that still belongs to a live user.",
      })
    );
  }

  if (hasActiveSubscription) {
    return yield* Effect.fail(
      new CustomerHasActiveSubscription({
        code: customerHasActiveSubscriptionCode,
        message:
          "Cannot delete a Polar customer that still has an active subscription.",
      })
    );
  }

  if (authUser) {
    return yield* Effect.fail(
      new CustomerExternalIdInUse({
        code: customerExternalIdInUseCode,
        message:
          "Cannot delete a Polar customer whose external ID still belongs to a live user.",
      })
    );
  }

  yield* polarGateway.deleteCustomer(input.polarCustomerId);
  yield* deleteLocalCustomer(ctx, customer.id);

  return null;
});
