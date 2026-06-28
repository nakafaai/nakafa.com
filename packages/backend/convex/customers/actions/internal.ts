import { internalAction } from "@repo/backend/convex/_generated/server";
import {
  cleanupCustomerDataForDeletedUser,
  syncOptionalCustomer,
} from "@repo/backend/convex/customers/sync/impl";
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
