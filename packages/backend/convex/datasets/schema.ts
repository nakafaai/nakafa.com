// packages/backend/convex/datasets/schema.ts
import { defineTable } from "convex/server";
import { v } from "convex/values";

export const tables = {
  // ============================================================================
  // UNIFIED TASK SYSTEM (Handles ALL research operations)
  // ============================================================================

  datasetTasks: defineTable({
    datasetId: v.id("datasets"),
    userId: v.id("users"),
    chatId: v.id("chats"),

    // Task type - what are we doing?
    type: v.union(
      v.literal("create_dataset"), // Initial dataset creation
      v.literal("add_column"), // Research new column
      v.literal("update_column"), // Re-research existing column
      v.literal("backfill") // Fill missing values
    ),

    // What we're researching
    query: v.optional(v.string()), // Original user query (for create_dataset)
    columnIds: v.array(v.string()), // Which columns to research

    // Status
    status: v.union(
      v.literal("initializing"),
      v.literal("discovering"), // Finding entities (create_dataset only)
      v.literal("researching"), // Researching data
      v.literal("completed"),
      v.literal("cancelled")
    ),

    // Progress tracking
    targetRows: v.number(), // How many rows to process
    processedRows: v.number(), // Rows processed so far
    successfulRows: v.number(), // Rows with data found

    // Metadata
    errorMessage: v.optional(v.string()),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("datasetId", ["datasetId"])
    .index("userId", ["userId"])
    .index("chatId", ["chatId"])
    .index("datasetId_status", ["datasetId", "status"])
    .index("type", ["type"]),

  // ============================================================================
  // DATASET METADATA
  // ============================================================================

  datasets: defineTable({
    userId: v.id("users"),
    chatId: v.id("chats"),
    name: v.string(),
    description: v.optional(v.string()),
    version: v.number(),
    rowCount: v.number(),
    columnCount: v.number(),
    updatedAt: v.number(),
  })
    .index("chatId_updatedAt", ["chatId", "updatedAt"])
    .index("userId_updatedAt", ["userId", "updatedAt"])
    .index("userId", ["userId"]),

  // ============================================================================
  // COLUMN DEFINITIONS
  // ============================================================================

  datasetColumns: defineTable({
    datasetId: v.id("datasets"),
    name: v.string(),
    displayName: v.string(),
    dataType: v.union(
      v.literal("text"),
      v.literal("number"),
      v.literal("url"),
      v.literal("date"),
      v.literal("boolean"),
      v.literal("json")
    ),
    isRequired: v.boolean(),
    order: v.number(),
    description: v.optional(v.string()),
    unit: v.optional(v.string()),
  })
    .index("datasetId", ["datasetId"])
    .index("datasetId_order", ["datasetId", "order"])
    .index("datasetId_name", ["datasetId", "name"]),

  // ============================================================================
  // DATA ROWS
  // ============================================================================

  datasetRows: defineTable({
    datasetId: v.id("datasets"),
    taskId: v.id("datasetTasks"),
    // All data stored in dynamicData for maximum flexibility
    // NOTE: These 3 fields are ALWAYS present (generated during entity discovery):
    //   - entityName: string (entity display name)
    //   - description: string (entity description)
    //   - url: string (entity official URL)
    // Additional fields from deep research are also stored here
    dynamicData: v.record(v.string(), v.any()),
    order: v.number(),
    updatedAt: v.number(),
  })
    .index("datasetId_order", ["datasetId", "order"])
    .index("taskId", ["taskId"]),

  // ============================================================================
  // CELL CONFIDENCE (Per cell overall assessment)
  // ============================================================================

  datasetConfidences: defineTable({
    rowId: v.id("datasetRows"),
    datasetId: v.id("datasets"), // Denormalized for analytics
    fieldName: v.string(),
    confidence: v.number(), // Overall confidence (0-1)
    sourceCount: v.number(), // How many sources found
    reasoning: v.string(), // Overall reasoning for this cell
    updatedAt: v.number(),
  })
    .index("rowId", ["rowId"])
    .index("rowId_fieldName", ["rowId", "fieldName"])
    .index("datasetId_fieldName", ["datasetId", "fieldName"]),

  // ============================================================================
  // CELL CITATIONS (Per cell individual sources)
  // ============================================================================

  datasetCitations: defineTable({
    rowId: v.id("datasetRows"),
    datasetId: v.id("datasets"),
    fieldName: v.string(),
    source: v.string(),
    title: v.optional(v.string()),
    excerpt: v.optional(v.string()),
    confidence: v.number(), // This citation's confidence
    reasoning: v.string(), // This source's reasoning
    searchQuery: v.optional(v.string()),
    retrievedAt: v.number(),
    date: v.optional(v.string()),
  })
    .index("rowId", ["rowId"])
    .index("rowId_fieldName", ["rowId", "fieldName"])
    .index("datasetId", ["datasetId"])
    .index("datasetId_fieldName", ["datasetId", "fieldName"]),

  // ============================================================================
  // URL LOCKS (Deduplication)
  // ============================================================================

  datasetUrlLocks: defineTable({
    datasetId: v.id("datasets"),
    url: v.string(),
    status: v.union(
      v.literal("locked"),
      v.literal("completed"),
      v.literal("failed")
    ),
    lockedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("datasetId_url", ["datasetId", "url"])
    .index("datasetId_status", ["datasetId", "status"]),
};

export default tables;
