import { internal } from "@repo/backend/convex/_generated/api";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import {
  ensurePolarCustomer,
  updatePolarCustomerMetadata,
} from "@repo/backend/convex/customers/polar";
import type { WithoutSystemFields } from "convex/server";
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

  return syncCustomerForUser(ctx, {
    localCustomerId: localCustomer?.id,
    user,
  });
}
