import { internalAction } from "@repo/backend/convex/_generated/server";
import { cleanupDeletedUserBilling } from "@repo/backend/convex/customers/deletion/billing";
import { syncOptionalCustomer } from "@repo/backend/convex/customers/sync/impl";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { v } from "convex/values";

/**
 * Sync customer between Polar and local database.
 * For scheduling from authenticated customer workflows.
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

/** Removes and anonymizes billing data for one deleted app user. */
export const cleanupDeletedUserCustomerData = internalAction({
  args: {
    authId: v.string(),
    userId: vv.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) =>
    await runConvexProgram(
      cleanupDeletedUserBilling(ctx, args.userId, args.authId)
    ),
});
