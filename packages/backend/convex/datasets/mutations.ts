import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { safeGetAppUser } from "../auth";
import { internalMutation, mutation } from "../functions";
import { workflow } from "../workflow";
import tables from "./schema";

/**
 * Create a new dataset (called from AI tool).
 */
export const createDataset = mutation({
  args: {
    chatId: v.id("chats"),
    query: v.string(),
    targetRows: v.number(),
  },
  handler: async (ctx, args) => {
    // Authentication check
    const user = await safeGetAppUser(ctx);
    if (!user) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "You must be logged in to create datasets.",
      });
    }

    // Check if dataset already exists for this chat
    const existingDataset = await ctx.db
      .query("datasets")
      .withIndex("chatId_updatedAt", (q) => q.eq("chatId", args.chatId))
      .first();

    if (existingDataset) {
      throw new ConvexError({
        code: "DATASET_EXISTS",
        message: "A dataset already exists for this chat.",
      });
    }

    // Create dataset
    const datasetId = await ctx.db.insert("datasets", {
      chatId: args.chatId,
      userId: user.appUser._id,
      name: args.query,
      version: 1,
      rowCount: 0,
      columnCount: 0,
      updatedAt: Date.now(),
    });

    await workflow.start(
      ctx,
      internal.datasets.workflows.createDatasetWorkflow,
      {
        datasetId,
        chatId: args.chatId,
        userId: user.appUser._id,
        query: args.query,
        targetRows: args.targetRows,
      }
    );

    return { datasetId };
  },
});

export const addDatasetColumns = internalMutation({
  args: {
    datasetId: v.id("datasets"),
    columns: v.array(
      v.object({
        ...tables.datasetColumns.validator.fields,
        datasetId: v.optional(v.id("datasets")), // make it optional here to allow for upserting columns without a datasetId
      })
    ),
  },
  handler: async (ctx, args) => {
    const { datasetId, columns } = args;
    const dataset = await ctx.db.get("datasets", datasetId);
    if (!dataset) {
      throw new ConvexError({
        code: "DATASET_NOT_FOUND",
        message: "Dataset not found.",
      });
    }

    for (const column of columns) {
      await ctx.db.insert("datasetColumns", {
        datasetId,
        ...column,
      });
    }

    // Update dataset column count
    await ctx.db.patch("datasets", datasetId, {
      columnCount: dataset.columnCount + columns.length,
      updatedAt: Date.now(),
    });

    return datasetId;
  },
});

/**
 * Add a new dataset task. Used to track the progress of the dataset creation process.
 */
export const addDatasetTask = internalMutation({
  args: {
    task: tables.datasetTasks.validator,
  },
  handler: async (ctx, args) => {
    const { task } = args;
    const dataset = await ctx.db.get("datasets", task.datasetId);
    if (!dataset) {
      throw new ConvexError({
        code: "DATASET_NOT_FOUND",
        message: "Dataset not found.",
      });
    }

    const datasetTaskId = await ctx.db.insert("datasetTasks", {
      ...task,
    });

    return datasetTaskId;
  },
});

/**
 * Update the status of a dataset task.
 * Used to update the status of a dataset task.
 */
export const updateDatasetTaskStatus = internalMutation({
  args: {
    datasetTaskId: v.id("datasetTasks"),
    status: v.union(
      v.literal("initializing"),
      v.literal("discovering"),
      v.literal("researching"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { datasetTaskId, status, errorMessage } = args;
    const datasetTask = await ctx.db.get("datasetTasks", datasetTaskId);
    if (!datasetTask) {
      throw new ConvexError({
        code: "DATASET_TASK_NOT_FOUND",
        message: "Dataset task not found.",
      });
    }

    const updates: {
      status: typeof status;
      updatedAt: number;
      errorMessage?: string;
      completedAt?: number;
    } = {
      status,
      updatedAt: Date.now(),
    };

    if (errorMessage !== undefined) {
      updates.errorMessage = errorMessage;
    }

    if (status === "completed" || status === "cancelled") {
      updates.completedAt = Date.now();
    }

    await ctx.db.patch("datasetTasks", datasetTaskId, updates);

    return datasetTaskId;
  },
});

/**
 * Acquire URL lock. Used to prevent duplicate URL scraping.
 */
export const acquireUrlLock = internalMutation({
  args: {
    datasetId: v.id("datasets"),
    url: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("datasetUrlLocks")
      .withIndex("datasetId_url", (q) =>
        q.eq("datasetId", args.datasetId).eq("url", args.url)
      )
      .first();

    if (existing) {
      return {
        datasetUrlLockId: existing._id,
        url: existing.url,
      };
    }

    const datasetUrlLockId = await ctx.db.insert("datasetUrlLocks", {
      datasetId: args.datasetId,
      url: args.url,
      status: "locked",
      lockedAt: Date.now(),
    });

    return {
      datasetUrlLockId,
      url: args.url,
    };
  },
});

/**
 * Insert rows into dataset.
 * Generic function that can insert rows with or without data.
 * NOTE: entityName, description, and url are stored in dynamicData
 */
export const insertDatasetRows = internalMutation({
  args: {
    datasetId: v.id("datasets"),
    taskId: v.id("datasetTasks"),
    rows: v.array(
      v.object({
        dynamicData: v.record(v.string(), v.any()),
        order: v.number(),
        updatedAt: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const rowData: Record<
      Id<"datasetRows">,
      { url: string; entityName: string }
    > = {};

    // Insert all rows
    for (const row of args.rows) {
      const rowId = await ctx.db.insert("datasetRows", {
        datasetId: args.datasetId,
        taskId: args.taskId,
        dynamicData: row.dynamicData,
        order: row.order,
        updatedAt: row.updatedAt ?? Date.now(),
      });

      // Extract entityName and url from dynamicData for return value (type-safe)
      const entityName = row.dynamicData?.entityName;
      const url = row.dynamicData?.url;

      // Validate required fields exist
      if (typeof entityName === "string" && typeof url === "string") {
        rowData[rowId] = { url, entityName };
      } else {
        throw new ConvexError({
          code: "INVALID_ROW_DATA",
          message: `Row at order ${row.order} is missing required fields: entityName or url`,
        });
      }
    }

    // Update dataset row count
    await ctx.db.patch("datasets", args.datasetId, {
      rowCount: args.rows.length,
      updatedAt: Date.now(),
    });

    return rowData;
  },
});

/**
 * Update descriptions for rows using rowId-keyed map.
 * Updates the description field inside dynamicData.
 */
export const updateRowDescriptions = internalMutation({
  args: {
    descriptions: v.record(v.id("datasetRows"), v.string()),
  },
  handler: async (ctx, args) => {
    // Update each row description in dynamicData
    // Object.entries converts keys to strings, but we know they're Id<"datasetRows">
    const entries = Object.entries(args.descriptions) as [
      Id<"datasetRows">,
      string,
    ][];

    for (const [rowId, description] of entries) {
      const row = await ctx.db.get("datasetRows", rowId);

      if (!row) {
        console.warn(`Row ${rowId} not found, skipping description update`);
        continue;
      }

      // Type-safe access to dynamicData
      const currentDynamicData = row.dynamicData ?? {};

      await ctx.db.patch("datasetRows", rowId, {
        dynamicData: {
          ...currentDynamicData,
          description,
        },
        updatedAt: Date.now(),
      });
    }
  },
});

/**
 * Update all cells for a row (atomic).
 * NOTE: This preserves entityName, description, and url in dynamicData
 * and only updates/adds the researched fields.
 */
export const updateRowCells = internalMutation({
  args: {
    rowId: v.id("datasetRows"),
    datasetId: v.id("datasets"),
    results: v.array(
      v.object({
        fieldName: v.string(),
        value: v.union(v.string(), v.number(), v.boolean(), v.null()),
        confidence: v.number(),
        sourceCount: v.number(),
        reasoning: v.string(),
        citations: v.array(
          v.object({
            source: v.string(),
            title: v.optional(v.string()),
            excerpt: v.optional(v.string()),
            confidence: v.number(),
            reasoning: v.string(),
            searchQuery: v.optional(v.string()),
            retrievedAt: v.number(),
            date: v.optional(v.string()),
          })
        ),
      })
    ),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get("datasetRows", args.rowId);
    if (!row) {
      throw new ConvexError({
        code: "ROW_NOT_FOUND",
        message: `Row ${args.rowId} not found.`,
      });
    }

    // Build new dynamicData - preserve existing data and add/update researched fields
    // Type-safe access with optional chaining
    const currentDynamicData = row.dynamicData ?? {};
    const newDynamicData: Record<string, string | number | boolean | null> = {
      ...currentDynamicData,
    };

    // Add researched field values (but NOT entityName, description, url)
    for (const result of args.results) {
      newDynamicData[result.fieldName] = result.value;
    }

    // Update row
    await ctx.db.patch("datasetRows", args.rowId, {
      dynamicData: newDynamicData,
      updatedAt: Date.now(),
    });

    // Insert confidences
    for (const result of args.results) {
      await ctx.db.insert("datasetConfidences", {
        rowId: args.rowId,
        datasetId: args.datasetId,
        fieldName: result.fieldName,
        confidence: result.confidence,
        sourceCount: result.sourceCount,
        reasoning: result.reasoning,
        updatedAt: Date.now(),
      });
    }

    // Insert citations
    let totalCitations = 0;
    for (const result of args.results) {
      for (const citation of result.citations) {
        await ctx.db.insert("datasetCitations", {
          rowId: args.rowId,
          datasetId: args.datasetId,
          fieldName: result.fieldName,
          source: citation.source,
          title: citation.title,
          excerpt: citation.excerpt,
          confidence: citation.confidence,
          reasoning: citation.reasoning,
          searchQuery: citation.searchQuery,
          retrievedAt: citation.retrievedAt,
          date: citation.date,
        });
        totalCitations += 1;
      }
    }

    console.log("[DB] ✓ Row cells updated:", {
      rowId: args.rowId.substring(0, 8),
      fields: args.results.length,
      citations: totalCitations,
    });
  },
});

/**
 * Mark row research complete.
 * Updates task progress and URL lock status.
 */
export const completeRowResearch = internalMutation({
  args: {
    taskId: v.id("datasetTasks"),
    datasetId: v.id("datasets"),
    url: v.string(),
    successful: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Update task progress
    const task = await ctx.db.get("datasetTasks", args.taskId);
    if (task) {
      await ctx.db.patch("datasetTasks", args.taskId, {
        processedRows: task.processedRows + 1,
        successfulRows: args.successful
          ? task.successfulRows + 1
          : task.successfulRows,
        updatedAt: Date.now(),
      });
    }

    // Update URL lock
    const lock = await ctx.db
      .query("datasetUrlLocks")
      .withIndex("datasetId_url", (q) =>
        q.eq("datasetId", args.datasetId).eq("url", args.url)
      )
      .first();

    if (lock) {
      await ctx.db.patch("datasetUrlLocks", lock._id, {
        status: "completed",
        completedAt: Date.now(),
      });
    }
  },
});
