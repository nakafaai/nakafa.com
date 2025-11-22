import { ConvexError, v } from "convex/values";
import { query } from "../_generated/server";
import { safeGetAppUser } from "../auth";

/**
 * Get the dataset for a chat.
 * Each chat can only have ONE dataset (1:1 relationship).
 * Returns null if no dataset exists for this chat.
 */
export const getDataset = query({
  args: {
    chatId: v.id("chats"),
  },
  handler: async (ctx, args) => {
    // Authentication check
    const user = await safeGetAppUser(ctx);
    if (!user) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "You must be logged in to view datasets.",
      });
    }

    // Get the dataset for this chat (only 1 should exist)
    const dataset = await ctx.db
      .query("datasets")
      .withIndex("chatId_updatedAt", (q) => q.eq("chatId", args.chatId))
      .order("desc")
      .first();

    if (!dataset) {
      return null;
    }

    // Authorization check
    if (dataset.userId !== user.appUser._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "You do not have permission to access this dataset.",
      });
    }

    return dataset;
  },
});

/**
 * Get columns for a dataset
 */
export const getDatasetColumns = query({
  args: {
    datasetId: v.id("datasets"),
  },
  handler: async (ctx, args) => {
    const user = await safeGetAppUser(ctx);
    if (!user) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "You must be logged in to view dataset columns.",
      });
    }

    // Verify dataset belongs to user
    const dataset = await ctx.db.get(args.datasetId);
    if (!dataset) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Dataset not found.",
      });
    }

    if (dataset.userId !== user.appUser._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "You do not have permission to access this dataset.",
      });
    }

    // Get columns ordered by their order field
    const columns = await ctx.db
      .query("datasetColumns")
      .withIndex("datasetId_order", (q) => q.eq("datasetId", args.datasetId))
      .collect();

    return columns;
  },
});

/**
 * Get rows for a dataset with pagination
 */
export const getDatasetRows = query({
  args: {
    datasetId: v.id("datasets"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await safeGetAppUser(ctx);
    if (!user) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "You must be logged in to view dataset rows.",
      });
    }

    // Verify dataset belongs to user
    const dataset = await ctx.db.get(args.datasetId);
    if (!dataset) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Dataset not found.",
      });
    }

    if (dataset.userId !== user.appUser._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "You do not have permission to access this dataset.",
      });
    }

    // Get rows ordered by their order field
    const limit = args.limit ?? 100;
    const rows = await ctx.db
      .query("datasetRows")
      .withIndex("datasetId_order", (q) => q.eq("datasetId", args.datasetId))
      .take(limit);

    return rows;
  },
});
