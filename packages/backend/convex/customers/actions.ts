import { api, internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { action, internalAction } from "@repo/backend/convex/_generated/server";
import {
  convertToDatabaseCustomer,
  requireCustomer,
} from "@repo/backend/convex/customers/utils";
import { requireAuthForAction } from "@repo/backend/convex/lib/helpers/auth";
import { vv } from "@repo/backend/convex/lib/validators";
import { ConvexError, v } from "convex/values";

/**
 * Sync customer between Polar and local database.
 * For scheduling from auth triggers.
 * Uses same logic as requireCustomer but returns local DB ID.
 */
export const syncCustomer = internalAction({
  args: { userId: vv.id("users") },
  returns: vv.id("customers"),
  handler: async (ctx, args): Promise<Id<"customers">> => {
    const user = await ctx.runQuery(api.auth.getUserById, {
      userId: args.userId,
    });

    if (!user) {
      throw new ConvexError({
        code: "USER_NOT_FOUND",
        message: "User not found",
        userId: args.userId,
      });
    }

    const polarCustomer = await ctx.runAction(
      internal.customers.polar.ensureCustomer,
      {
        externalId: user.authUser._id,
        email: user.authUser.email,
        name: user.authUser.name,
        metadata: { userId: args.userId },
      }
    );

    return await ctx.runMutation(internal.customers.mutations.upsertCustomer, {
      customer: convertToDatabaseCustomer({
        ...polarCustomer,
        userId: args.userId,
      }),
    });
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

    const checkout = await ctx.runAction(
      internal.customers.polar.createCheckoutSession,
      {
        customerId: customer.id,
        productIds: args.productIds,
        successUrl: args.successUrl,
      }
    );

    return { url: checkout.url };
  },
});

export const generateCustomerPortalUrl = action({
  args: {},
  returns: v.object({ url: v.string() }),
  handler: async (ctx): Promise<{ url: string }> => {
    const { appUser } = await requireAuthForAction(ctx);
    const customer = await requireCustomer(ctx, appUser._id);

    return await ctx.runAction(
      internal.customers.polar.createCustomerPortalSession,
      { customerId: customer.id }
    );
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
      await ctx.runAction(internal.customers.polar.deleteCustomer, {
        id: customer.id,
      });
    }
  },
});
