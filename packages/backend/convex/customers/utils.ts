import type { Customer } from "@polar-sh/sdk/models/components/customer.js";
import type {
  GenericActionCtx,
  GenericDataModel,
  WithoutSystemFields,
} from "convex/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";

/**
 * Convert Polar customer to database format.
 * Maps Polar customer fields to local database schema.
 */
export function convertToDatabaseCustomer(
  customer: Customer & { userId: Id<"users"> }
): WithoutSystemFields<Doc<"customers">> {
  return {
    id: customer.id,
    externalId: customer.externalId,
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
  const authUser = await ctx.runQuery(internal.betterAuth.auth.getUserByEmail, {
    email: customerData.email,
  });
  if (authUser?.userId) {
    return authUser.userId as Id<"users">;
  }

  return null;
}
