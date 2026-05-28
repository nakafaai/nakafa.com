import type { GenericId } from "@confect/core";
import type { Doc } from "@repo/backend/confect/_generated/dataModel";
import refs from "@repo/backend/confect/_generated/refs";
import {
  ActionCtx,
  MutationRunner,
  QueryRunner,
} from "@repo/backend/confect/_generated/services";
import {
  createPolarCheckoutSession,
  createPolarCustomerPortalSession,
  deletePolarCustomer,
  ensurePolarCustomer,
  type NormalizedPolarCustomer,
  PolarCustomerEmailConflict,
  updatePolarCustomerMetadata,
} from "@repo/backend/confect/modules/commerce/polar/customers";
import { readPolarServer } from "@repo/backend/confect/modules/commerce/polar/env";
import { getProductsForServer } from "@repo/backend/confect/modules/commerce/polar/products";
import { requireAppUserForAction } from "@repo/backend/confect/modules/identity/auth/action.service";
import { authEnvironment } from "@repo/backend/confect/modules/identity/auth.env";
import { captureProductEvent } from "@repo/backend/confect/modules/integrations/analytics";
import { Clock, Effect, Schema } from "effect";

const siteOrigin = new URL(authEnvironment.siteUrl).origin;

interface CustomerFields {
  readonly externalId: string | null;
  readonly id: string;
  readonly metadata: NormalizedPolarCustomer["metadata"];
  readonly userId: GenericId.GenericId<"users">;
}

export class CustomerActionError extends Schema.TaggedError<CustomerActionError>()(
  "CustomerActionError",
  { message: Schema.String }
) {}

/** Converts a Polar customer into the local customer row shape. */
function convertToDatabaseCustomer(
  customer: NormalizedPolarCustomer & {
    readonly userId: GenericId.GenericId<"users">;
  }
): CustomerFields {
  return {
    externalId: customer.externalId,
    id: customer.id,
    metadata: customer.metadata,
    userId: customer.userId,
  };
}

/** Ensures a local user has matching Polar and local customer records. */
const syncCustomerForUser = Effect.fn("commerce.syncCustomerForUser")(
  function* (args: {
    readonly localCustomerId?: string;
    readonly user: Doc<"users">;
  }) {
    const runMutation = yield* MutationRunner;
    const polarCustomer = yield* ensurePolarCustomer({
      email: args.user.email,
      externalId: args.user.authId,
      localCustomerId: args.localCustomerId,
      metadata: { userId: args.user._id },
      name: args.user.name,
    });
    const syncedPolarCustomer =
      Object.keys(polarCustomer.metadata).length === 0
        ? yield* updatePolarCustomerMetadata({
            id: polarCustomer.id,
            metadata: { userId: args.user._id },
          })
        : polarCustomer;
    const customer = convertToDatabaseCustomer({
      ...syncedPolarCustomer,
      userId: args.user._id,
    });
    const localCustomerId = yield* runMutation(
      refs.internal.customers.mutations.internalFunctions.upsertCustomer,
      { customer }
    );

    return { ...customer, localCustomerId };
  }
);

/** Requires a user and returns its synchronized customer row. */
const requireCustomer = Effect.fn("commerce.requireCustomer")(function* (
  userId: GenericId.GenericId<"users">
) {
  const runQuery = yield* QueryRunner;
  const user = yield* runQuery(refs.internal.users.queries.getUserById, {
    userId,
  });
  const localCustomer = yield* runQuery(
    refs.internal.customers.queries.internalFunctions.customer
      .getCustomerByUserId,
    { userId }
  );

  if (!user) {
    return yield* Effect.fail(
      new CustomerActionError({
        message: `User not found for userId: ${userId}`,
      })
    );
  }

  return yield* syncCustomerForUser({
    localCustomerId: localCustomer?.id,
    user,
  });
});

/** Synchronizes the Polar customer for a user if the user still exists. */
export const syncCustomer = Effect.fn("commerce.syncCustomer")(
  function* (args: { userId: GenericId.GenericId<"users"> }) {
    const runQuery = yield* QueryRunner;
    const user = yield* runQuery(refs.internal.users.queries.getUserById, {
      userId: args.userId,
    });
    const localCustomer = yield* runQuery(
      refs.internal.customers.queries.internalFunctions.customer
        .getCustomerByUserId,
      { userId: args.userId }
    );

    if (!user) {
      return null;
    }

    const customer = yield* syncCustomerForUser({
      localCustomerId: localCustomer?.id,
      user,
    });

    return customer.localCustomerId;
  }
);

/** Repairs a user's Polar customer and reports email conflicts without deleting data. */
export const repairCustomer = Effect.fn("commerce.repairCustomer")(
  function* (args: { userId: GenericId.GenericId<"users"> }) {
    const runQuery = yield* QueryRunner;
    const user = yield* runQuery(refs.internal.users.queries.getUserById, {
      userId: args.userId,
    });
    const localCustomer = yield* runQuery(
      refs.internal.customers.queries.internalFunctions.customer
        .getCustomerByUserId,
      { userId: args.userId }
    );

    if (!user) {
      return yield* Effect.fail(
        new CustomerActionError({
          message: `User not found for userId: ${args.userId}`,
        })
      );
    }

    const result = yield* Effect.either(
      syncCustomerForUser({
        localCustomerId: localCustomer?.id,
        user,
      })
    );

    if (result._tag === "Right") {
      return {
        localCustomerId: result.right.localCustomerId,
        status: "synced" as const,
      };
    }

    if (result.left instanceof PolarCustomerEmailConflict) {
      return {
        existingExternalId: result.left.existingExternalId,
        polarCustomerId: result.left.polarCustomerId,
        status: "conflict" as const,
      };
    }

    return yield* Effect.fail(result.left);
  }
);

/** Deletes Polar and local customer data for a deleted app user. */
export const cleanupUserData = Effect.fn("commerce.cleanupUserData")(
  function* (args: { userId: GenericId.GenericId<"users"> }) {
    const runQuery = yield* QueryRunner;
    const runMutation = yield* MutationRunner;
    const customer = yield* runQuery(
      refs.internal.customers.queries.internalFunctions.customer
        .getCustomerByUserId,
      { userId: args.userId }
    );

    if (customer?.id) {
      yield* deletePolarCustomer(customer.id);
      yield* runMutation(
        refs.internal.customers.mutations.internalFunctions.deleteCustomerById,
        { id: customer.id }
      );
    }

    return null;
  }
);

/** Deletes a stale Polar customer only after proving no live user owns it. */
export const cleanupStalePolarCustomer = Effect.fn(
  "commerce.cleanupStalePolarCustomer"
)(function* (args: {
  existingExternalId: string | null;
  polarCustomerId: string;
}) {
  const runQuery = yield* QueryRunner;
  const runMutation = yield* MutationRunner;
  const customer = yield* runQuery(
    refs.internal.customers.queries.internalFunctions.customer
      .getCustomerByPolarId,
    { polarCustomerId: args.polarCustomerId }
  );

  if (!customer) {
    return null;
  }

  const user = yield* runQuery(refs.internal.users.queries.getUserById, {
    userId: customer.userId,
  });
  if (user) {
    return yield* Effect.fail(
      new CustomerActionError({
        message:
          "Cannot delete a Polar customer that still belongs to a live user.",
      })
    );
  }

  const hasActiveSubscription = yield* runQuery(
    refs.internal.customers.queries.internalFunctions.customer
      .hasActiveSubscriptionByCustomerId,
    { customerId: args.polarCustomerId }
  );
  if (hasActiveSubscription) {
    return yield* Effect.fail(
      new CustomerActionError({
        message:
          "Cannot delete a Polar customer that still has an active subscription.",
      })
    );
  }

  if (args.existingExternalId) {
    const authUser = yield* runQuery(
      refs.internal.users.queries.getUserByAuthId,
      { authId: args.existingExternalId }
    );
    if (authUser) {
      return yield* Effect.fail(
        new CustomerActionError({
          message:
            "Cannot delete a Polar customer whose external ID still belongs to a live user.",
        })
      );
    }
  }

  yield* deletePolarCustomer(args.polarCustomerId);
  yield* runMutation(
    refs.internal.customers.mutations.internalFunctions.deleteCustomerById,
    { id: customer.id }
  );

  return null;
});

/** Validates a checkout success URL against the primary site origin. */
const requireAllowedSuccessUrl = Effect.fn("commerce.requireSuccessUrl")(
  function* (successUrl: string) {
    if (!URL.canParse(successUrl)) {
      return yield* Effect.fail(
        new CustomerActionError({
          message: "Checkout success URL must be a valid absolute URL.",
        })
      );
    }

    const url = new URL(successUrl);
    if (url.origin === siteOrigin) {
      return successUrl;
    }

    return yield* Effect.fail(
      new CustomerActionError({
        message: "Checkout success URL must stay on the primary site origin.",
      })
    );
  }
);

/** Validates selected checkout products against configured Polar products. */
const requireAllowedCheckoutProducts = Effect.fn(
  "commerce.requireCheckoutProducts"
)(function* (productIds: readonly string[]) {
  const server = yield* readPolarServer();
  const allowedCheckoutProductIds = new Set(
    Object.values(getProductsForServer(server)).map((product) => product.id)
  );
  const [primaryProductId] = productIds;

  if (!primaryProductId) {
    return yield* Effect.fail(
      new CustomerActionError({
        message: "Checkout requires at least one allowed product.",
      })
    );
  }

  for (const productId of productIds) {
    if (allowedCheckoutProductIds.has(productId)) {
      continue;
    }

    return yield* Effect.fail(
      new CustomerActionError({
        message: "Checkout requested an unsupported product.",
      })
    );
  }

  return { primaryProductId, productIds };
});

/** Creates a Polar checkout link for the current user. */
export const generateCheckoutLink = Effect.fn("commerce.generateCheckoutLink")(
  function* (args: { productIds: readonly string[]; successUrl: string }) {
    const ctx = yield* ActionCtx;
    const { appUser } = yield* requireAppUserForAction();
    const customer = yield* requireCustomer(appUser._id);
    const { primaryProductId, productIds } =
      yield* requireAllowedCheckoutProducts(args.productIds);
    const successUrl = yield* requireAllowedSuccessUrl(args.successUrl);
    const checkout = yield* createPolarCheckoutSession({
      customerId: customer.id,
      productIds,
      successUrl,
    });
    const now = yield* Clock.currentTimeMillis;

    yield* Effect.promise(() =>
      captureProductEvent(ctx, {
        distinctId: appUser._id,
        event: {
          name: "checkout started",
          properties: {
            product_count: productIds.length,
            product_id: primaryProductId,
          },
        },
        timestamp: new Date(now),
      })
    );

    return { url: checkout.url };
  }
);

/** Creates a Polar customer portal link for the current user. */
export const generateCustomerPortalUrl = Effect.fn(
  "commerce.generateCustomerPortalUrl"
)(function* () {
  const { appUser } = yield* requireAppUserForAction();
  const customer = yield* requireCustomer(appUser._id);

  return yield* createPolarCustomerPortalSession({ customerId: customer.id });
});
