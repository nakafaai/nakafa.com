import type { Customer } from "@polar-sh/sdk/models/components/customer.js";
import type {
  GenericActionCtx,
  GenericDataModel,
  WithoutSystemFields,
} from "convex/server";
import { ConvexError } from "convex/values";
import { api, components, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";

/**
 * Convert Polar customer to database format.
 * Maps Polar customer fields to local database schema.
 */
export function convertToDatabaseCustomer(
  customer: Customer & { userId: Id<"users"> }
): WithoutSystemFields<Doc<"customers">> {
  return {
    id: customer.id,
    externalId: customer.externalId ?? null,
    userId: customer.userId,
    metadata: customer.metadata,
  };
}

/**
 * Find app user ID from Polar customer data.
 *
 * Tries to match customer to app user by:
 * 1. externalId (Better Auth user ID)
 * 2. Email in app users table
 * 3. Email in Better Auth table
 *
 * Used by webhooks to sync customer data to correct user.
 */
export async function findUserIdFromCustomer(
  ctx: GenericActionCtx<GenericDataModel>,
  customerData: { externalId?: string | null; email: string }
): Promise<Id<"users"> | null> {
  // Try to find by externalId (Better Auth user ID)
  const authId = customerData.externalId;
  if (authId) {
    const user = await ctx.runQuery(internal.users.queries.getUserByAuthId, {
      authId,
    });
    if (user) {
      return user._id;
    }
  }

  // Try to find by email in app users table
  const user = await ctx.runQuery(internal.users.queries.getUserByEmail, {
    email: customerData.email,
  });
  if (user) {
    return user._id;
  }

  // Try to find by email in Better Auth table
  const authUser = await ctx.runQuery(
    components.betterAuth.queries.getUserByEmail,
    {
      email: customerData.email,
    }
  );
  if (authUser?.userId) {
    return authUser.userId as Id<"users">;
  }

  return null;
}

/**
 * Get customer for authenticated user.
 * Single Polar API call that handles all edge cases:
 * - Customer exists locally and in Polar → returns it
 * - Customer exists locally but deleted from Polar → recreates in Polar
 * - Customer doesn't exist → creates in Polar
 * - Race condition (concurrent creates) → handles gracefully
 * Always syncs result to local DB.
 */
export async function requireCustomer(ctx: ActionCtx, userId: Id<"users">) {
  const [user, localCustomer] = await Promise.all([
    ctx.runQuery(api.auth.getUserById, { userId }),
    ctx.runQuery(internal.customers.queries.getCustomerByUserId, { userId }),
  ]);

  if (!user) {
    throw new ConvexError({
      code: "USER_NOT_FOUND",
      message: `User not found for userId: ${userId}`,
    });
  }

  // Single Polar action handles get/create/race-condition
  const polarCustomer = await ctx.runAction(
    internal.customers.polar.ensureCustomer,
    {
      localCustomerId: localCustomer?.id,
      externalId: user.authUser._id,
      email: user.authUser.email,
      name: user.authUser.name,
      metadata: { userId },
    }
  );

  // Update metadata if empty (migration case)
  let finalCustomer = polarCustomer;
  if (Object.keys(polarCustomer.metadata).length === 0) {
    finalCustomer = await ctx.runAction(
      internal.customers.polar.updateCustomerMetadata,
      { id: polarCustomer.id, metadata: { userId } }
    );
  }

  const customer = convertToDatabaseCustomer({ ...finalCustomer, userId });
  // Sync to local DB (idempotent upsert)
  await ctx.runMutation(internal.customers.mutations.upsertCustomer, {
    customer,
  });

  return customer;
}
