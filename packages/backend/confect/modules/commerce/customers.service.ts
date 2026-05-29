import { GenericId } from "@confect/core";
import type { Doc } from "@repo/backend/confect/_generated/dataModel";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import type { PaginationOptions } from "convex/server";
import { Effect, Option, Schema } from "effect";

type CustomerFields = Omit<Doc<"customers">, "_creationTime" | "_id">;
const decodeUserId = Schema.decodeUnknownOption(GenericId.GenericId("users"));

/** Patches an existing customer row with the latest Polar identity fields. */
const patchCustomerRow = Effect.fnUntraced(function* (
  customer: Doc<"customers">,
  nextCustomer: CustomerFields
) {
  const writer = yield* DatabaseWriter;

  yield* writer.table("customers").patch(customer._id, {
    externalId: nextCustomer.externalId,
    id: nextCustomer.id,
    metadata: nextCustomer.metadata,
    userId: nextCustomer.userId,
  });
});

/** Deletes a customer row by Polar customer id. */
export const deleteCustomerById = Effect.fnUntraced(function* (args: {
  id: string;
}) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const customer = yield* reader
    .table("customers")
    .get("by_polarId", args.id)
    .pipe(Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)));

  if (!customer) {
    return null;
  }

  yield* writer.table("customers").delete(customer._id);
  return null;
});

/** Upserts a customer row while merging possible user-id and Polar-id matches. */
export const upsertCustomer = Effect.fnUntraced(function* (args: {
  customer: CustomerFields;
}) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const existingByUser = yield* reader
    .table("customers")
    .get("by_userId", args.customer.userId)
    .pipe(Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)));
  const existingByPolarId = yield* reader
    .table("customers")
    .get("by_polarId", args.customer.id)
    .pipe(Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)));

  if (existingByUser && existingByPolarId) {
    if (existingByUser._id === existingByPolarId._id) {
      yield* patchCustomerRow(existingByUser, args.customer);
      return existingByUser._id;
    }

    yield* patchCustomerRow(existingByPolarId, args.customer);
    yield* writer.table("customers").delete(existingByUser._id);
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

  return yield* writer.table("customers").insert(args.customer);
});

/** Reads a customer row by app user id. */
export const getCustomerByUserId = Effect.fnUntraced(function* (args: {
  userId: GenericId.GenericId<"users">;
}) {
  const reader = yield* DatabaseReader;
  return yield* reader
    .table("customers")
    .get("by_userId", args.userId)
    .pipe(Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)));
});

/** Reads a customer row by Polar customer id. */
export const getCustomerByPolarId = Effect.fnUntraced(function* (args: {
  polarCustomerId: string;
}) {
  const reader = yield* DatabaseReader;
  return yield* reader
    .table("customers")
    .get("by_polarId", args.polarCustomerId)
    .pipe(Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)));
});

/** Returns whether a Polar customer currently has an active subscription. */
export const hasActiveSubscriptionByCustomerId = Effect.fnUntraced(
  function* (args: { customerId: string }) {
    const reader = yield* DatabaseReader;
    const subscription = yield* reader
      .table("subscriptions")
      .index("by_customerId_and_status", (query) =>
        query.eq("customerId", args.customerId).eq("status", "active")
      )
      .first();

    return Option.isSome(subscription);
  }
);

/** Resolves an app user id from Polar metadata or external id. */
export const getUserIdByPolarCustomer = Effect.fnUntraced(function* (args: {
  externalId?: string;
  metadataUserId?: string;
}) {
  const reader = yield* DatabaseReader;

  if (args.metadataUserId) {
    const metadataUserId = Option.getOrNull(decodeUserId(args.metadataUserId));
    if (metadataUserId) {
      const userByMetadataId = yield* reader
        .table("users")
        .get(metadataUserId)
        .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));
      if (userByMetadataId) {
        return userByMetadataId._id;
      }
    }
  }

  if (!args.externalId) {
    return null;
  }

  const externalId = args.externalId;
  const userByExternalId = yield* reader
    .table("users")
    .get("by_authId", externalId)
    .pipe(Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)));

  return userByExternalId?._id ?? null;
});

/** Lists users for customer integrity verification scripts. */
export const listUsersForCustomerIntegrity = Effect.fnUntraced(
  function* (args: { paginationOpts: PaginationOptions }) {
    const reader = yield* DatabaseReader;
    const rows = yield* reader
      .table("users")
      .index("by_creation_time")
      .paginate(args.paginationOpts);

    return {
      continueCursor: rows.continueCursor,
      isDone: rows.isDone,
      page: rows.page.map((row) => ({
        authId: row.authId,
        email: row.email,
        userId: row._id,
      })),
    };
  }
);

/** Lists local customers for customer integrity verification scripts. */
export const listCustomersForIntegrity = Effect.fnUntraced(function* (args: {
  paginationOpts: PaginationOptions;
}) {
  const reader = yield* DatabaseReader;
  const rows = yield* reader
    .table("customers")
    .index("by_creation_time")
    .paginate(args.paginationOpts);

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
export const listActiveSubscriptionsForIntegrity = Effect.fnUntraced(
  function* (args: { paginationOpts: PaginationOptions }) {
    const reader = yield* DatabaseReader;
    const rows = yield* reader
      .table("subscriptions")
      .index("by_creation_time")
      .paginate(args.paginationOpts);

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
  }
);
