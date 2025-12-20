import { ConvexError, v } from "convex/values";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { action, internalAction } from "../_generated/server";
import { requireAuthForAction } from "../lib/authHelpers";
import { convertToDatabaseCustomer, requireCustomer } from "./utils";

/**
 * Sync customer between Polar and local database.
 * For scheduling from auth triggers.
 * Uses same logic as requireCustomer but returns local DB ID.
 */
export const syncCustomer = internalAction({
  args: { userId: v.id("users") },
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
