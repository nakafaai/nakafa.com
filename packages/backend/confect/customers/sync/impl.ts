import type { Docs } from "@repo/backend/confect/_generated/docs";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import refs from "@repo/backend/confect/_generated/refs";
import {
  MutationRunner,
  QueryRunner,
} from "@repo/backend/confect/_generated/services";
import customersTable from "@repo/backend/confect/_generated/tables/customers";
import { isAccountDeletionPending } from "@repo/backend/confect/auth/deletion/state";
import { deleteLocalCustomer } from "@repo/backend/confect/customers/deletion/billingState";
import {
  ensureCustomer,
  normalizeStoredCustomer,
} from "@repo/backend/confect/customers/polar/impl";
import { polarGateway } from "@repo/backend/confect/customers/polar/live";
import {
  customerIdMetadataKey,
  type PolarMetadata,
} from "@repo/backend/confect/customers/polar/spec";
import { convertToDatabaseCustomer } from "@repo/backend/confect/customers/records";
import { settleCustomerSync } from "@repo/backend/confect/customers/sync/settlement";
import {
  customerSyncIoError,
  UserNotFound,
  userNotFoundCode,
} from "@repo/backend/confect/customers/sync/spec";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { WithoutSystemFields } from "convex/server";
import { Effect, flow, Record as Rec, Schema } from "effect";

type CustomerSyncUser = Pick<
  Docs["users"],
  "_id" | "authId" | "deletedAt" | "deletionPreparedAt" | "email" | "name"
>;
const requiredCustomerValidator = Schema.Struct({
  ...customersTable.Fields.fields,
  localCustomerId: IdSchema("customers"),
});
export type RequiredCustomer = typeof requiredCustomerValidator.Type;

/** Loads the app user and any already-linked local customer row. */
const loadCustomerSyncState = Effect.fn("customers.sync.loadCustomerSyncState")(
  function* (userId: Id<"users">) {
    const { runQuery } = yield* QueryRunner;
    return yield* Effect.all([
      runQuery(refs.internal.users.queries.getUserById, {
        userId,
      }),
      runQuery(
        refs.internal.customers.queries.internal.customer.getCustomerByUserId,
        {
          userId,
        }
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
  }
);

/** Upserts the local customer row after Polar has been reconciled. */
const saveLocalCustomer = Effect.fn("customers.sync.saveLocalCustomer")(
  function* (customer: WithoutSystemFields<Docs["customers"]>) {
    const { runMutation } = yield* MutationRunner;
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
  }
);

/**
 * Reconciles Polar and local customer state for a known app user document.
 */
export const syncCustomerForUser = Effect.fn(
  "customers.sync.syncCustomerForUser"
)(function* (input: {
  readonly localCustomerId?: string | null;
  readonly user: CustomerSyncUser;
}) {
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
  if (Rec.keys(polarCustomer.metadata).length === 0) {
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
  const result = yield* saveLocalCustomer(customer);
  const localCustomerId = yield* settleCustomerSync(result, input.user._id, {
    deleteLocalCustomer: () => deleteLocalCustomer(syncedPolarCustomer.id),
    deletePolarCustomer: () =>
      polarGateway.deleteCustomer(syncedPolarCustomer.id),
  });
  return {
    ...customer,
    localCustomerId,
  } satisfies RequiredCustomer;
});

/** Reconciles customer data for a user id, returning null when the user vanished. */
export const syncOptionalCustomer = Effect.fn(
  "customers.sync.syncOptionalCustomer"
)(function* (userId: Id<"users">) {
  const [user, localCustomer] = yield* loadCustomerSyncState(userId);
  if (!user || isAccountDeletionPending(user)) {
    return null;
  }
  return yield* syncCustomerForUser({
    ...(localCustomer?.id === undefined
      ? {}
      : {
          localCustomerId: localCustomer?.id,
        }),
    user,
  }).pipe(Effect.catchTag("UserNotFound", () => Effect.succeed(null)));
});

/** Reconciles and returns the customer for an authenticated app user. */
export const requireCustomer = Effect.fn("customers.sync.requireCustomer")(
  function* (userId: Id<"users">) {
    const [user, localCustomer] = yield* loadCustomerSyncState(userId);
    if (!user || isAccountDeletionPending(user)) {
      return yield* new UserNotFound({
        code: userNotFoundCode,
        message: `User not found for userId: ${userId}`,
      });
    }
    return yield* syncCustomerForUser({
      ...(localCustomer?.id === undefined
        ? {}
        : {
            localCustomerId: localCustomer?.id,
          }),
      user,
    });
  }
);
