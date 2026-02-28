import { internalQuery, query } from "@repo/backend/convex/_generated/server";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { v } from "convex/values";

/**
 * Get current user's credit balance.
 * Used by frontend to display credits.
 */
export const getMyCredits = query({
  args: {},
  returns: v.object({
    credits: v.number(),
    creditsResetAt: v.number(),
  }),
  handler: async (ctx) => {
    const { appUser } = await requireAuth(ctx);

    return {
      credits: appUser.credits ?? 0,
      creditsResetAt: appUser.creditsResetAt ?? 0,
    };
  },
});

/**
 * Get users who need their credits reset.
 * Internal query used by workflow.
 * Uses cursor-based pagination for scalability.
 */
export const getUsersNeedingReset = internalQuery({
  args: {
    resetTimestamp: v.number(),
    cursor: v.optional(v.id("users")),
    batchSize: v.number(),
  },
  returns: v.array(
    v.object({
      _id: v.id("users"),
      credits: v.optional(v.number()),
    })
  ),
  handler: async (ctx, args) => {
    // Query users whose credits haven't been reset since resetTimestamp
    let query = ctx.db
      .query("users")
      .withIndex("creditsResetAt", (q) =>
        q.lt("creditsResetAt", args.resetTimestamp)
      );

    // If cursor provided, continue from there
    if (args.cursor) {
      const cursor = args.cursor;
      query = ctx.db
        .query("users")
        .withIndex("creditsResetAt", (q) =>
          q.lt("creditsResetAt", args.resetTimestamp)
        )
        .filter((q) => q.gt(q.field("_id"), cursor));
    }

    const users = await query.take(args.batchSize);

    return users.map((user) => ({
      _id: user._id,
      credits: user.credits,
    }));
  },
});

/**
 * Get credit transaction history for current user.
 * Paginated for performance.
 */
export const getMyTransactionHistory = query({
  args: {
    paginationOpts: v.object({
      cursor: v.optional(v.string()),
      numItems: v.number(),
    }),
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("creditTransactions"),
        amount: v.number(),
        type: v.string(),
        balanceAfter: v.number(),
        createdAt: v.number(),
      })
    ),
    continueCursor: v.optional(v.string()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const { appUser } = await requireAuth(ctx);

    const result = await ctx.db
      .query("creditTransactions")
      .withIndex("userId", (q) => q.eq("userId", appUser._id))
      .order("desc")
      .paginate({
        cursor: args.paginationOpts.cursor ?? null,
        numItems: args.paginationOpts.numItems,
      });

    return {
      page: result.page.map((tx) => ({
        _id: tx._id,
        amount: tx.amount,
        type: tx.type,
        balanceAfter: tx.balanceAfter,
        createdAt: tx._creationTime,
      })),
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});
