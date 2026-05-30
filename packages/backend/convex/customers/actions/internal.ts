import { internalAction } from "@repo/backend/convex/_generated/server";
import {
  cleanupCustomerDataForDeletedUser,
  cleanupOrphanedPolarCustomer,
  repairCustomerMapping,
  syncOptionalCustomer,
} from "@repo/backend/convex/customers/sync/impl";
import { repairCustomerResultValidator } from "@repo/backend/convex/customers/sync/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { v } from "convex/values";

/**
 * Sync customer between Polar and local database.
 * For scheduling from auth triggers.
 * Reuses the shared customer sync helper so Polar and local writes stay aligned.
 */
export const syncCustomer = internalAction({
  args: { userId: vv.id("users") },
  returns: vv.nullable(vv.id("customers")),
  handler: async (ctx, args) => {
    const customer = await runConvexProgram(
      syncOptionalCustomer(ctx, args.userId)
    );

    return customer?.localCustomerId ?? null;
  },
});

/** Repairs one user's customer mapping and returns structured conflict details. */
export const repairCustomer = internalAction({
  args: { userId: vv.id("users") },
  returns: repairCustomerResultValidator,
  handler: async (ctx, args) =>
    await runConvexProgram(repairCustomerMapping(ctx, args.userId)),
});

/**
 * Clean up all user-related data when user is deleted.
 * Called from auth trigger when Better Auth user is deleted.
 * Deletes Polar customer to prevent orphaned customers that cause email conflicts.
 */
export const cleanupUserData = internalAction({
  args: { userId: vv.id("users") },
  returns: v.null(),
  handler: async (ctx, args) =>
    await runConvexProgram(cleanupCustomerDataForDeletedUser(ctx, args.userId)),
});

/**
 * Delete one stale Polar customer after verifying that no live user or active
 * subscription still depends on it.
 */
export const cleanupStalePolarCustomer = internalAction({
  args: {
    existingExternalId: v.union(v.string(), v.null()),
    polarCustomerId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) =>
    await runConvexProgram(cleanupOrphanedPolarCustomer(ctx, args)),
});
