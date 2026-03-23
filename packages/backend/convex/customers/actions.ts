import { internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { action, internalAction } from "@repo/backend/convex/_generated/server";
import {
  createPolarCheckoutSession,
  createPolarCustomerPortalSession,
  deletePolarCustomer,
} from "@repo/backend/convex/customers/polar";
import {
  requireCustomer,
  syncCustomerForUser,
} from "@repo/backend/convex/customers/utils";
import { requireAuthForAction } from "@repo/backend/convex/lib/helpers/auth";
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
  handler: async (ctx, args): Promise<Id<"customers"> | null> => {
    const [user, localCustomer] = await Promise.all([
      ctx.runQuery(internal.users.queries.getUserById, {
        userId: args.userId,
      }),
      ctx.runQuery(internal.customers.queries.getCustomerByUserId, {
        userId: args.userId,
      }),
    ]);

    if (!user) {
      return null;
    }

    const customer = await syncCustomerForUser(ctx, {
      localCustomerId: localCustomer?.id,
      user,
    });

    return customer.localCustomerId;
  },
});

export const generateCheckoutLink = action({
  args: {
    productIds: v.array(v.string()),
    successUrl: v.string(),
  },
  returns: v.object({ url: v.string() }),
  handler: async (ctx, args): Promise<{ url: string }> => {
    const { appUser } = await requireAuthForAction(ctx);
    const customer = await requireCustomer(ctx, appUser._id);

    const checkout = await createPolarCheckoutSession({
      customerId: customer.id,
      productIds: args.productIds,
      successUrl: args.successUrl,
    });

    return { url: checkout.url };
  },
});

export const generateCustomerPortalUrl = action({
  args: {},
  returns: v.object({ url: v.string() }),
  handler: async (ctx): Promise<{ url: string }> => {
    const { appUser } = await requireAuthForAction(ctx);
    const customer = await requireCustomer(ctx, appUser._id);

    return await createPolarCustomerPortalSession({ customerId: customer.id });
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
  handler: async (ctx, args) => {
    const customer = await ctx.runQuery(
      internal.customers.queries.getCustomerByUserId,
      { userId: args.userId }
    );

    if (customer?.id) {
      await deletePolarCustomer(customer.id);

      await ctx.runMutation(internal.customers.mutations.deleteCustomerById, {
        id: customer.id,
      });
    }

    return null;
  },
});
