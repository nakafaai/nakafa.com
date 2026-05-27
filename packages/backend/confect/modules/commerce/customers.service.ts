import type { GenericId } from "@confect/core";
import type { Doc } from "@repo/backend/confect/_generated/dataModel";
import {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/confect/_generated/services";
import type { PaginationOptions } from "convex/server";
import { Effect } from "effect";

type CustomerFields = Omit<Doc<"customers">, "_creationTime" | "_id">;

/** Patches an existing customer row with the latest Polar identity fields. */
const patchCustomerRow = Effect.fn("commerce.patchCustomerRow")(function* (
  customer: Doc<"customers">,
  nextCustomer: CustomerFields
) {
  const ctx = yield* MutationCtx;

  yield* Effect.promise(() =>
    ctx.db.patch(customer._id, {
      externalId: nextCustomer.externalId,
      id: nextCustomer.id,
      metadata: nextCustomer.metadata,
      userId: nextCustomer.userId,
    })
  );
});

/** Deletes a customer row by Polar customer id. */
export const deleteCustomerById = Effect.fn("commerce.deleteCustomerById")(
  function* (args: { id: string }) {
    const ctx = yield* MutationCtx;
    const customer = yield* Effect.promise(() =>
      ctx.db
        .query("customers")
        .withIndex("by_polarId", (query) => query.eq("id", args.id))
        .unique()
    );

    if (!customer) {
      return null;
    }

    yield* Effect.promise(() => ctx.db.delete(customer._id));
    return null;
  }
);

/** Upserts a customer row while merging possible user-id and Polar-id matches. */
export const upsertCustomer = Effect.fn("commerce.upsertCustomer")(
  function* (args: { customer: CustomerFields }) {
    const ctx = yield* MutationCtx;
    const existingByUser = yield* Effect.promise(() =>
      ctx.db
        .query("customers")
        .withIndex("by_userId", (query) =>
          query.eq("userId", args.customer.userId)
        )
        .unique()
    );
    const existingByPolarId = yield* Effect.promise(() =>
      ctx.db
        .query("customers")
        .withIndex("by_polarId", (query) => query.eq("id", args.customer.id))
        .unique()
    );

    if (existingByUser && existingByPolarId) {
      if (existingByUser._id === existingByPolarId._id) {
        yield* patchCustomerRow(existingByUser, args.customer);
        return existingByUser._id;
      }

      yield* patchCustomerRow(existingByPolarId, args.customer);
      yield* Effect.promise(() => ctx.db.delete(existingByUser._id));
      return existingByPolarId._id;
    }

    if (existingByPolarId) {
      yield* patchCustomerRow(existingByPolarId, args.customer);
      return existingByPolarId._id;
    }

    if (existingByUser) {
      yield* patchCustomerRow(existingByUser, args.customer);
      return existingByUser._id;
    }

    return yield* Effect.promise(() =>
      ctx.db.insert("customers", args.customer)
    );
  }
);

/** Reads a customer row by app user id. */
export const getCustomerByUserId = Effect.fn("commerce.getCustomerByUserId")(
  function* (args: { userId: GenericId.GenericId<"users"> }) {
    const ctx = yield* QueryCtx;
    return yield* Effect.promise(() =>
      ctx.db
        .query("customers")
        .withIndex("by_userId", (query) => query.eq("userId", args.userId))
        .unique()
    );
  }
);

/** Reads a customer row by Polar customer id. */
export const getCustomerByPolarId = Effect.fn("commerce.getCustomerByPolarId")(
  function* (args: { polarCustomerId: string }) {
    const ctx = yield* QueryCtx;
    return yield* Effect.promise(() =>
      ctx.db
        .query("customers")
        .withIndex("by_polarId", (query) =>
          query.eq("id", args.polarCustomerId)
        )
        .unique()
    );
  }
);

/** Returns whether a Polar customer currently has an active subscription. */
export const hasActiveSubscriptionByCustomerId = Effect.fn(
  "commerce.hasActiveSubscriptionByCustomerId"
)(function* (args: { customerId: string }) {
  const ctx = yield* QueryCtx;
  const subscription = yield* Effect.promise(() =>
    ctx.db
      .query("subscriptions")
      .withIndex("by_customerId_and_status", (query) =>
        query.eq("customerId", args.customerId).eq("status", "active")
      )
      .first()
  );

  return subscription !== null;
});

/** Resolves an app user id from Polar metadata or external id. */
export const getUserIdByPolarCustomer = Effect.fn(
  "commerce.getUserIdByPolarCustomer"
)(function* (args: { externalId?: string; metadataUserId?: string }) {
  const ctx = yield* QueryCtx;

  if (args.metadataUserId) {
    const metadataUserId = ctx.db.normalizeId("users", args.metadataUserId);
    if (metadataUserId) {
      const userByMetadataId = yield* Effect.promise(() =>
        ctx.db.get(metadataUserId)
      );
      if (userByMetadataId) {
        return userByMetadataId._id;
      }
    }
  }

  if (!args.externalId) {
    return null;
  }

  const externalId = args.externalId;
  const userByExternalId = yield* Effect.promise(() =>
    ctx.db
      .query("users")
      .withIndex("by_authId", (query) => query.eq("authId", externalId))
      .unique()
  );

  return userByExternalId?._id ?? null;
});

/** Lists users for customer integrity verification scripts. */
export const listUsersForCustomerIntegrity = Effect.fn(
  "commerce.listUsersForCustomerIntegrity"
)(function* (args: { paginationOpts: PaginationOptions }) {
  const ctx = yield* QueryCtx;
  const rows = yield* Effect.promise(() =>
    ctx.db.query("users").paginate(args.paginationOpts)
  );

  return {
    continueCursor: rows.continueCursor,
    isDone: rows.isDone,
    page: rows.page.map((row) => ({
      authId: row.authId,
      email: row.email,
      userId: row._id,
    })),
  };
});

/** Lists local customers for customer integrity verification scripts. */
export const listCustomersForIntegrity = Effect.fn(
  "commerce.listCustomersForIntegrity"
)(function* (args: { paginationOpts: PaginationOptions }) {
  const ctx = yield* QueryCtx;
  const rows = yield* Effect.promise(() =>
    ctx.db.query("customers").paginate(args.paginationOpts)
  );

  return {
    continueCursor: rows.continueCursor,
    isDone: rows.isDone,
    page: rows.page.map((row) => ({
      externalId: row.externalId,
      localCustomerId: row._id,
      polarCustomerId: row.id,
      userId: row.userId,
    })),
  };
});

/** Lists active subscriptions for customer integrity verification scripts. */
export const listActiveSubscriptionsForIntegrity = Effect.fn(
  "commerce.listActiveSubscriptionsForIntegrity"
)(function* (args: { paginationOpts: PaginationOptions }) {
  const ctx = yield* QueryCtx;
  const rows = yield* Effect.promise(() =>
    ctx.db.query("subscriptions").paginate(args.paginationOpts)
  );

  return {
    continueCursor: rows.continueCursor,
    isDone: rows.isDone,
    page: rows.page
      .filter((row) => row.status === "active")
      .map((row) => ({
        currentPeriodEnd: row.currentPeriodEnd,
        customerId: row.customerId,
        status: row.status,
        subscriptionId: row.id,
      })),
  };
});
