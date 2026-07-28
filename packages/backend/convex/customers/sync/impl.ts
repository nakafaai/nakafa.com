import { internal } from "@repo/backend/convex/_generated/api";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { isAccountDeletionPending } from "@repo/backend/convex/auth/deletion/state";
import { deleteLocalCustomer } from "@repo/backend/convex/customers/deletion/billingState";
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
  type CustomerSyncIoError,
  customerSyncIoError,
  UserNotFound,
  userNotFoundCode,
} from "@repo/backend/convex/customers/sync/spec";
import type { WithoutSystemFields } from "convex/server";
import { Effect } from "effect";

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
) => Effect.Effect<Id<"customers"> | null, CustomerSyncIoError> = Effect.fn(
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

  if (!localCustomerId) {
    yield* polarGateway.deleteCustomer(syncedPolarCustomer.id);
    yield* deleteLocalCustomer(ctx, syncedPolarCustomer.id);

    return yield* new UserNotFound({
      code: userNotFoundCode,
      message: `User not found for userId: ${input.user._id}`,
    });
  }

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

  if (!user || isAccountDeletionPending(user)) {
    return null;
  }

  return yield* syncCustomerForUser(ctx, {
    localCustomerId: localCustomer?.id,
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
    localCustomerId: localCustomer?.id,
    user,
  });
});
