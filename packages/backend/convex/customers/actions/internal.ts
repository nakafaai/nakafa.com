import { internal } from "@repo/backend/convex/_generated/api";
import { internalAction } from "@repo/backend/convex/_generated/server";
import { deletePolarCustomer } from "@repo/backend/convex/customers/polar";
import { syncCustomerForUser } from "@repo/backend/convex/customers/utils";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { ConvexError, v } from "convex/values";

const repairCustomerResultValidator = v.union(
  v.object({
    localCustomerId: vv.id("customers"),
    status: v.literal("synced"),
  }),
  v.object({
    existingExternalId: v.union(v.string(), v.null()),
    polarCustomerId: v.string(),
    status: v.literal("conflict"),
  })
);

/** Extracts structured duplicate-email conflict details from customer sync errors. */
function getPolarCustomerConflictDetails(error: unknown) {
  if (!(error instanceof ConvexError)) {
    return null;
  }

  const data = error.data;

  if (typeof data !== "object" || data === null) {
    return null;
  }

  if (!("code" in data) || data.code !== "POLAR_CUSTOMER_EMAIL_CONFLICT") {
    return null;
  }

  if (!("detail" in data) || typeof data.detail !== "string") {
    return null;
  }

  const parsed = JSON.parse(data.detail);

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof parsed.polarCustomerId !== "string"
  ) {
    return null;
  }

  return {
    existingExternalId:
      typeof parsed.existingExternalId === "string"
        ? parsed.existingExternalId
        : null,
    polarCustomerId: parsed.polarCustomerId,
  };
}

/**
 * Sync customer between Polar and local database.
 * For scheduling from auth triggers.
 * Reuses the shared customer sync helper so Polar and local writes stay aligned.
 */
export const syncCustomer = internalAction({
  args: { userId: vv.id("users") },
  returns: vv.nullable(vv.id("customers")),
  handler: async (ctx, args) => {
    const [user, localCustomer] = await Promise.all([
      ctx.runQuery(internal.users.queries.getUserById, {
        userId: args.userId,
      }),
      ctx.runQuery(
        internal.customers.queries.internal.customer.getCustomerByUserId,
        {
          userId: args.userId,
        }
      ),
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

/** Repairs one user's customer mapping and returns structured conflict details. */
export const repairCustomer = internalAction({
  args: { userId: vv.id("users") },
  returns: repairCustomerResultValidator,
  handler: async (ctx, args) => {
    const [user, localCustomer] = await Promise.all([
      ctx.runQuery(internal.users.queries.getUserById, {
        userId: args.userId,
      }),
      ctx.runQuery(
        internal.customers.queries.internal.customer.getCustomerByUserId,
        {
          userId: args.userId,
        }
      ),
    ]);

    if (!user) {
      throw new ConvexError({
        code: "USER_NOT_FOUND",
        message: `User not found for userId: ${args.userId}`,
      });
    }

    try {
      const customer = await syncCustomerForUser(ctx, {
        localCustomerId: localCustomer?.id,
        user,
      });

      return {
        localCustomerId: customer.localCustomerId,
        status: "synced" as const,
      };
    } catch (error) {
      const conflict = getPolarCustomerConflictDetails(error);

      if (!conflict) {
        throw error;
      }

      return {
        existingExternalId: conflict.existingExternalId,
        polarCustomerId: conflict.polarCustomerId,
        status: "conflict" as const,
      };
    }
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
      internal.customers.queries.internal.customer.getCustomerByUserId,
      { userId: args.userId }
    );

    if (customer?.id) {
      await deletePolarCustomer(customer.id);

      await ctx.runMutation(
        internal.customers.mutations.internal.deleteCustomerById,
        {
          id: customer.id,
        }
      );
    }

    return null;
  },
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
  handler: async (ctx, args) => {
    const customer = await ctx.runQuery(
      internal.customers.queries.internal.customer.getCustomerByPolarId,
      {
        polarCustomerId: args.polarCustomerId,
      }
    );

    if (!customer) {
      return null;
    }

    const [user, authUser, hasActiveSubscription] = await Promise.all([
      customer
        ? ctx.runQuery(internal.users.queries.getUserById, {
            userId: customer.userId,
          })
        : Promise.resolve(null),
      args.existingExternalId
        ? ctx.runQuery(internal.users.queries.getUserByAuthId, {
            authId: args.existingExternalId,
          })
        : Promise.resolve(null),
      ctx.runQuery(
        internal.customers.queries.internal.customer
          .hasActiveSubscriptionByCustomerId,
        {
          customerId: args.polarCustomerId,
        }
      ),
    ]);

    if (user) {
      throw new ConvexError({
        code: "CUSTOMER_NOT_ORPHANED",
        message:
          "Cannot delete a Polar customer that still belongs to a live user.",
      });
    }

    if (hasActiveSubscription) {
      throw new ConvexError({
        code: "CUSTOMER_HAS_ACTIVE_SUBSCRIPTION",
        message:
          "Cannot delete a Polar customer that still has an active subscription.",
      });
    }

    if (authUser) {
      throw new ConvexError({
        code: "CUSTOMER_EXTERNAL_ID_IN_USE",
        message:
          "Cannot delete a Polar customer whose external ID still belongs to a live user.",
      });
    }

    await deletePolarCustomer(args.polarCustomerId);

    if (customer) {
      await ctx.runMutation(
        internal.customers.mutations.internal.deleteCustomerById,
        {
          id: customer.id,
        }
      );
    }

    return null;
  },
});
