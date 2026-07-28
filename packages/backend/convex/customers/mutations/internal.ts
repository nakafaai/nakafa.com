import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import tables from "@repo/backend/convex/customers/schema";
import {
  CustomerSyncIoError,
  customerSyncIoErrorCode,
} from "@repo/backend/convex/customers/sync/spec";
import { internalMutation } from "@repo/backend/convex/functions";
import {
  getUnknownErrorMessage,
  runConvexProgram,
} from "@repo/backend/convex/lib/effect";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { makeFunctionReference, type WithoutSystemFields } from "convex/server";
import { v } from "convex/values";
import { Effect } from "effect";

const CUSTOMER_SUBSCRIPTION_CLEANUP_BATCH_SIZE = 50;

const deleteCustomerByIdReference = makeFunctionReference<
  "mutation",
  { id: string },
  null
>("customers/mutations/internal:deleteCustomerById");

/** Patches one local customer row to the latest Polar-backed fields. */
async function patchCustomerRow(
  ctx: MutationCtx,
  customer: Pick<Doc<"customers">, "_id">,
  nextCustomer: WithoutSystemFields<Doc<"customers">>
) {
  await ctx.db.patch("customers", customer._id, {
    externalId: nextCustomer.externalId,
    id: nextCustomer.id,
    metadata: nextCustomer.metadata,
    userId: nextCustomer.userId,
  });
}

/** Maps local customer-deletion IO failures into the sync error contract. */
function toCustomerDeletionError(error: unknown) {
  return new CustomerSyncIoError({
    code: customerSyncIoErrorCode,
    message: `Failed to delete local customer data: ${getUnknownErrorMessage(error)}`,
  });
}

/** Lifts one local customer-deletion operation into the Effect error channel. */
function tryCustomerDeletion<A>(operation: () => Promise<A>) {
  return Effect.tryPromise({
    catch: toCustomerDeletionError,
    try: operation,
  });
}

/** Deletes local subscriptions before their customer-to-user mapping. */
export const deleteCustomerByIdProgram = Effect.fn(
  "customers.mutations.deleteCustomerById"
)(function* (ctx: MutationCtx, polarCustomerId: string) {
  const tombstone = yield* tryCustomerDeletion(() =>
    ctx.db
      .query("customerDeletionTombstones")
      .withIndex("by_polarCustomerId", (query) =>
        query.eq("polarCustomerId", polarCustomerId)
      )
      .unique()
  );

  if (!tombstone) {
    yield* tryCustomerDeletion(() =>
      ctx.db.insert("customerDeletionTombstones", {
        polarCustomerId,
      })
    );
  }

  const subscriptions = yield* tryCustomerDeletion(() =>
    ctx.db
      .query("subscriptions")
      .withIndex("by_customerId_and_status", (query) =>
        query.eq("customerId", polarCustomerId)
      )
      .take(CUSTOMER_SUBSCRIPTION_CLEANUP_BATCH_SIZE)
  );

  for (const subscription of subscriptions) {
    yield* tryCustomerDeletion(() =>
      ctx.db.delete("subscriptions", subscription._id)
    );
  }

  if (subscriptions.length === CUSTOMER_SUBSCRIPTION_CLEANUP_BATCH_SIZE) {
    yield* tryCustomerDeletion(() =>
      ctx.scheduler.runAfter(0, deleteCustomerByIdReference, {
        id: polarCustomerId,
      })
    );
    return null;
  }

  const customer = yield* tryCustomerDeletion(() =>
    ctx.db
      .query("customers")
      .withIndex("by_polarId", (query) => query.eq("id", polarCustomerId))
      .unique()
  );

  if (customer) {
    yield* tryCustomerDeletion(() => ctx.db.delete("customers", customer._id));
  }

  return null;
});

/**
 * Delete a customer by Polar customer ID.
 * Internal function - called from Polar webhooks only.
 */
export const deleteCustomerById = internalMutation({
  args: v.object({
    id: v.string(),
  }),
  returns: v.null(),
  handler: (ctx, args) =>
    runConvexProgram(deleteCustomerByIdProgram(ctx, args.id)),
});

/**
 * Upsert customer from Polar data.
 * Idempotent: safe to call multiple times with same data.
 * Handles both insert and update in a single transaction.
 * Used by webhooks and internal sync.
 * Polar is source of truth for all fields.
 */
export const upsertCustomer = internalMutation({
  args: {
    customer: tables.customers.validator,
  },
  returns: vv.nullable(vv.id("customers")),
  handler: async (ctx, args) => {
    const tombstone = await ctx.db
      .query("customerDeletionTombstones")
      .withIndex("by_polarCustomerId", (q) =>
        q.eq("polarCustomerId", args.customer.id)
      )
      .unique();

    if (tombstone) {
      return null;
    }

    const user = await ctx.db.get("users", args.customer.userId);

    if (!user || user.deletedAt !== undefined) {
      return null;
    }

    const existingByUser = await ctx.db
      .query("customers")
      .withIndex("by_userId", (q) => q.eq("userId", args.customer.userId))
      .unique();
    const existingByPolarId = await ctx.db
      .query("customers")
      .withIndex("by_polarId", (q) => q.eq("id", args.customer.id))
      .unique();

    if (existingByUser && existingByPolarId) {
      if (existingByUser._id === existingByPolarId._id) {
        await patchCustomerRow(ctx, existingByUser, args.customer);
        return existingByUser._id;
      }

      await patchCustomerRow(ctx, existingByPolarId, args.customer);
      await ctx.db.delete("customers", existingByUser._id);
      return existingByPolarId._id;
    }

    if (existingByPolarId) {
      await patchCustomerRow(ctx, existingByPolarId, args.customer);
      return existingByPolarId._id;
    }

    if (existingByUser) {
      await patchCustomerRow(ctx, existingByUser, args.customer);
      return existingByUser._id;
    }

    return ctx.db.insert("customers", args.customer);
  },
});
