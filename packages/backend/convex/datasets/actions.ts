import { model } from "@repo/ai/lib/providers";
import { generateObject } from "ai";
import { v } from "convex/values";
import { jsonrepair } from "jsonrepair";
import * as z from "zod";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction } from "../_generated/server";
import {
  generateColumnsPrompt,
  generateColumnsSchemaDescription,
} from "./prompts";
import tables from "./schema";

const ColumnSchema = z.object({
  name: z.string().describe("Camel case field name (e.g., annualRevenue)"),
  displayName: z
    .string()
    .describe("Human-readable name (e.g., Annual Revenue)"),
  dataType: z.enum(["text", "number", "url", "date", "boolean", "json"]),
  description: z.string().optional().describe("What this field represents"),
  unit: z.string().optional().describe("Unit (e.g., USD, employees, %)"),
  isRequired: z.boolean().describe("Is this field required?"),
});

/**
 * Generate column schema using AI.
 */
export const generateColumns = internalAction({
  args: {
    query: v.string(),
  },
  handler: async (_ctx, args) => {
    console.log(
      "[AI] Generating columns for query:",
      args.query.substring(0, 100)
    );

    const { object } = await generateObject({
      model: model.languageModel("grok-4-fast-non-reasoning"),
      schema: z.object({
        columns: z.array(ColumnSchema),
      }),
      schemaDescription: generateColumnsSchemaDescription(),
      experimental_repairText: async ({ text }) => jsonrepair(text),
      prompt: generateColumnsPrompt({ query: args.query }),
    });

    console.log("[AI] ✓ Columns generated:", {
      count: object.columns.length,
      names: object.columns.map((c) => c.name),
    });

    return object.columns.map((col, index) => ({
      ...col,
      order: index,
    }));
  },
});

/**
 * Discover entities from the web using Firecrawl with AI validation.
 * Wrapper action that calls Node.js action and handles mutations.
 */
export const discoverEntities = internalAction({
  args: {
    datasetId: v.id("datasets"),
    query: v.string(),
    targetRows: v.number(),
  },
  handler: async (ctx, args): Promise<Array<{ name: string; url: string }>> => {
    console.log("[DISCOVER] Starting entity discovery...", {
      targetRows: args.targetRows,
      query: args.query.substring(0, 100),
    });

    // Step 1: Call Node.js action to search and validate entities
    const validated = await ctx.runAction(
      internal.datasets.actionsNode.searchAndValidateEntities,
      {
        query: args.query,
        targetRows: args.targetRows,
      }
    );

    console.log("[DISCOVER] Validated entities from web:", {
      count: validated.length,
    });

    // Step 2: Acquire locks for deduplication (this can be done in regular action)
    const uniqueEntities: Array<{ name: string; url: string }> = [];

    for (const entity of validated) {
      if (uniqueEntities.length >= args.targetRows) {
        console.log("[DISCOVER] Target rows reached, stopping");
        break;
      }

      const lockResult = await ctx.runMutation(
        internal.datasets.mutations.acquireUrlLock,
        {
          datasetId: args.datasetId,
          url: entity.url,
        }
      );

      if (lockResult.datasetUrlLockId) {
        uniqueEntities.push(entity);
      }
    }

    console.log("[DISCOVER] ✓ Unique entities after deduplication:", {
      count: uniqueEntities.length,
      target: args.targetRows,
    });

    return uniqueEntities;
  },
});

/**
 * Generate AI descriptions for entities.
 * Wrapper that calls Node.js action for scraping.
 */
export const generateDescriptions = internalAction({
  args: {
    rowData: v.record(
      v.id("datasetRows"), // rowId as string key
      v.object({
        url: v.string(),
        entityName: v.string(),
      })
    ),
  },
  handler: async (ctx, args): Promise<Record<Id<"datasetRows">, string>> => {
    console.log("[DESCRIPTIONS] Generating descriptions for entities...", {
      count: Object.keys(args.rowData).length,
    });

    // Call Node.js action to scrape and generate descriptions
    const descriptions = await ctx.runAction(
      internal.datasets.actionsNode.scrapeAndGenerateDescriptions,
      { rowData: args.rowData }
    );

    console.log("[DESCRIPTIONS] ✓ Descriptions generated:", {
      count: Object.keys(descriptions).length,
    });

    return descriptions;
  },
});

/**
 * Research all rows - launches parallel research for each row.
 * No manual batching - Convex handles resource limits naturally.
 */
export const researchAllRows = internalAction({
  args: {
    taskId: v.id("datasetTasks"),
    datasetId: v.id("datasets"),
    rowData: v.record(
      v.id("datasetRows"),
      v.object({
        url: v.string(),
        entityName: v.string(),
      })
    ),
    descriptions: v.record(v.id("datasetRows"), v.string()),
    columns: v.array(
      v.object({
        ...tables.datasetColumns.validator.fields,
        datasetId: v.optional(v.id("datasets")),
      })
    ),
  },
  handler: async (ctx, args) => {
    const rowCount = Object.keys(args.rowData).length;
    const columnCount = args.columns.length;

    console.log("[RESEARCH] Starting parallel research for all rows...", {
      rows: rowCount,
      columns: columnCount,
      totalCells: rowCount * columnCount,
    });

    // Launch ALL rows at once - Convex handles limits!
    await Promise.all(
      Object.entries(args.rowData).map(async ([rowId, entityInfo]) => {
        const description = args.descriptions[rowId as Id<"datasetRows">] || "";

        console.log(`[RESEARCH] → Starting row: ${entityInfo.entityName}`);

        // Step 1: Do research (Node.js action - pure research)
        const results = await ctx.runAction(
          internal.datasets.actionsNode.researchRow,
          {
            entity: {
              name: entityInfo.entityName,
              url: entityInfo.url,
              description,
            },
            columns: args.columns,
          }
        );

        // Log the actual research results
        console.log(`[RESEARCH] ✓ ${entityInfo.entityName}:`, {
          rowId: rowId.substring(0, 8),
          fieldsFound: results.filter((r) => r.value !== null).length,
          totalFields: results.length,
          data: results.map((r) => ({
            field: r.fieldName,
            value: r.value,
            confidence: r.confidence,
            sources: r.sourceCount,
          })),
        });

        // Step 2: Save results (mutations)
        await ctx.runMutation(internal.datasets.mutations.updateRowCells, {
          rowId: rowId as Id<"datasetRows">,
          datasetId: args.datasetId,
          results,
        });

        // Step 3: Mark row complete
        await ctx.runMutation(internal.datasets.mutations.completeRowResearch, {
          taskId: args.taskId,
          datasetId: args.datasetId,
          url: entityInfo.url,
          successful: results.some((r) => r.value !== null),
        });
      })
    );

    console.log("[RESEARCH] ✓ All rows completed");
  },
});
