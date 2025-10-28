import { customersCreate } from "@polar-sh/sdk/funcs/customersCreate.js";
import { customersGet } from "@polar-sh/sdk/funcs/customersGet.js";
import { customersGetExternal } from "@polar-sh/sdk/funcs/customersGetExternal.js";
import type { Customer } from "@polar-sh/sdk/models/components/customer.js";
import { ConvexError, v } from "convex/values";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { type ActionCtx, action } from "../_generated/server";
import { polarClient } from "../utils/polar";
import { convertToDatabaseCustomer } from "./utils";

/**
 * Sync customer between Polar and local database.
 *
 * Ensures customer exists in both systems and data is synchronized.
 * Safe to call multiple times - idempotent operation.
 */
export const syncPolarCustomerFromUserId = action({
  args: {
    userId: v.id("users"),
  },
  returns: v.id("customers"),
  handler: async (ctx, args): Promise<Id<"customers">> => {
    // Step 1: Get Polar customer data (external API calls only)
    const polarCustomerData = await getPolarCustomerData({
      ctx,
      userId: args.userId,
    });

    // Step 2: Sync to database in a single atomic mutation
    const customerId = await ctx.runMutation(
      internal.customers.mutation.syncCustomerFromPolar,
      {
        customer: convertToDatabaseCustomer({
          ...polarCustomerData,
          userId: args.userId,
        }),
      }
    );

    return customerId;
  },
});

/**
 * Helper function to handle all Polar API interactions.
 * Separated for clarity and testability.
 */
async function getPolarCustomerData({
  ctx,
  userId,
}: {
  ctx: ActionCtx;
  userId: Id<"users">;
}): Promise<Customer> {
  // Get user data to access auth info
  const user = await ctx.runQuery(api.auth.getUserById, {
    userId,
  });

  if (!user) {
    throw new ConvexError({
      code: "USER_NOT_FOUND",
      message: `User not found for userId: ${userId}`,
    });
  }

  // Check if customer exists locally to get Polar ID
  const existingLocalCustomer = await ctx.runQuery(
    internal.customers.queries.getCustomerByUserId,
    {
      userId,
    }
  );

  // Try to get customer from Polar
  let polarCustomer: Customer | undefined;

  // If we have a local customer, try getting by Polar ID first (more efficient)
  if (existingLocalCustomer) {
    const polarGetResult = await customersGet(polarClient, {
      id: existingLocalCustomer.id,
    });

    if (polarGetResult.value) {
      polarCustomer = polarGetResult.value;
    }
  }

  // Fallback: Try getting by externalId if not found by ID
  if (!polarCustomer) {
    const polarExternalResult = await customersGetExternal(polarClient, {
      externalId: user.authUser._id,
    });

    if (polarExternalResult.value) {
      polarCustomer = polarExternalResult.value;
    }
  }

  // If customer doesn't exist in Polar, create it
  if (!polarCustomer) {
    const polarCreateResult = await customersCreate(polarClient, {
      externalId: user.authUser._id,
      email: user.authUser.email,
      name: user.authUser.name,
      metadata: {
        userId,
      },
    });

    if (!polarCreateResult.value) {
      throw new ConvexError({
        code: "POLAR_CUSTOMER_CREATION_FAILED",
        message:
          polarCreateResult.error?.message ||
          `Failed to create customer in Polar for user: ${user.authUser.email}`,
      });
    }

    polarCustomer = polarCreateResult.value;
  }

  return polarCustomer;
}
