import { customersCreate } from "@polar-sh/sdk/funcs/customersCreate.js";
import { customersGet } from "@polar-sh/sdk/funcs/customersGet.js";
import { ConvexError, v } from "convex/values";
import { api } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { action } from "../_generated/server";
import type { AppUser } from "../auth";
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
    // 1. Get user data
    const user: AppUser | null = await ctx.runQuery(api.auth.getUserById, {
      userId: args.userId,
    });

    if (!user) {
      throw new ConvexError({
        code: "USER_NOT_FOUND",
        message: `User not found for userId: ${args.userId}`,
      });
    }

    // 2. Check if customer exists in local database
    const existingCustomer: Doc<"customers"> | null = await ctx.runQuery(
      api.customers.queries.getCustomerByUserId,
      {
        userId: args.userId,
      }
    );

    // 3. If customer exists locally, verify and sync with Polar
    if (existingCustomer) {
      const polarGetResult = await customersGet(polarClient, {
        id: existingCustomer.id,
      });

      // Customer exists in both - update local DB with latest Polar data
      if (polarGetResult.ok && polarGetResult.value) {
        await ctx.runMutation(api.customers.mutation.updateCustomer, {
          customer: convertToDatabaseCustomer({
            ...polarGetResult.value,
            userId: args.userId,
          }),
        });
        return existingCustomer._id;
      }

      // Customer exists locally but not in Polar - this shouldn't happen but handle it
      // The local customer.id might be invalid, so create fresh in Polar
      const polarCreateResult = await customersCreate(polarClient, {
        externalId: user.authUser._id,
        email: user.authUser.email,
        name: user.authUser.name,
        metadata: {
          userId: args.userId,
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

      // Update local DB with new Polar customer ID
      await ctx.runMutation(api.customers.mutation.updateCustomer, {
        customer: convertToDatabaseCustomer({
          ...polarCreateResult.value,
          userId: args.userId,
        }),
      });

      return existingCustomer._id;
    }

    // 4. Neither exists - create customer in Polar first, then sync to local DB
    const polarCreateResult = await customersCreate(polarClient, {
      externalId: user.authUser._id,
      email: user.authUser.email,
      name: user.authUser.name,
      metadata: {
        userId: args.userId,
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

    // 5. Sync to local database
    const customerId = await ctx.runMutation(
      api.customers.mutation.insertCustomer,
      {
        customer: convertToDatabaseCustomer({
          ...polarCreateResult.value,
          userId: args.userId,
        }),
      }
    );

    return customerId;
  },
});
