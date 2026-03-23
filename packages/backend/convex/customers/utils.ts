import { components, internal } from "@repo/backend/convex/_generated/api";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import {
  ensurePolarCustomer,
  updatePolarCustomerMetadata,
} from "@repo/backend/convex/customers/polar";
import type {
  GenericActionCtx,
  GenericDataModel,
  WithoutSystemFields,
} from "convex/server";
import { ConvexError } from "convex/values";

type PolarMetadata = Record<string, string | number | boolean>;
type CustomerSyncUser = Pick<Doc<"users">, "_id" | "authId" | "email" | "name">;

export type RequiredCustomer = WithoutSystemFields<Doc<"customers">> & {
  localCustomerId: Id<"customers">;
};

/**
 * Convert Polar customer to database format.
 * Maps Polar customer fields to local database schema.
 */
export function convertToDatabaseCustomer(customer: {
  id: string;
  externalId?: string | null;
  metadata: PolarMetadata;
  userId: Id<"users">;
}): WithoutSystemFields<Doc<"customers">> {
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

  if (!authUser) {
    return null;
  }

  const userByAuthId = await ctx.runQuery(
    internal.users.queries.getUserByAuthId,
    {
      authId: authUser._id,
    }
  );

  if (!userByAuthId) {
    return null;
  }

  return userByAuthId._id;
}

export async function syncCustomerForUser(
  ctx: ActionCtx,
  args: {
    localCustomerId?: string | null;
    user: CustomerSyncUser;
  }
): Promise<RequiredCustomer> {
  const polarCustomer = await ensurePolarCustomer({
    localCustomerId: args.localCustomerId ?? undefined,
    externalId: args.user.authId,
    email: args.user.email,
    name: args.user.name,
    metadata: { userId: args.user._id },
  });

  let syncedPolarCustomer = polarCustomer;
  if (Object.keys(polarCustomer.metadata).length === 0) {
    syncedPolarCustomer = await updatePolarCustomerMetadata({
      id: polarCustomer.id,
      metadata: { userId: args.user._id },
    });
  }

  const customer = convertToDatabaseCustomer({
    ...syncedPolarCustomer,
    userId: args.user._id,
  });
  const localCustomerId = await ctx.runMutation(
    internal.customers.mutations.upsertCustomer,
    {
      customer,
    }
  );

  return { ...customer, localCustomerId };
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
export async function requireCustomer(
  ctx: ActionCtx,
  userId: Id<"users">
): Promise<RequiredCustomer> {
  const [user, localCustomer] = await Promise.all([
    ctx.runQuery(internal.users.queries.getUserById, { userId }),
    ctx.runQuery(internal.customers.queries.getCustomerByUserId, { userId }),
  ]);

  if (!user) {
    throw new ConvexError({
      code: "USER_NOT_FOUND",
      message: `User not found for userId: ${userId}`,
    });
  }

  return await syncCustomerForUser(ctx, {
    localCustomerId: localCustomer?.id,
    user,
  });
}
