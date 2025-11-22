"use node";

import { selectRelevantContent } from "@repo/ai/lib/content-selection";
import { firecrawlApp } from "@repo/ai/lib/firecrawl";
import { model } from "@repo/ai/lib/providers";
import { generateObject } from "ai";
import { v } from "convex/values";
import { jsonrepair } from "jsonrepair";
import * as z from "zod";
import type { Id } from "../_generated/dataModel";
import { internalAction } from "../_generated/server";
import {
  extractDescriptionsFromContentPrompt,
  extractDescriptionsSchemaDescription,
  extractEntitiesFromContentPrompt,
  extractEntitiesFromContentSchemaDescription,
  extractFieldValueFromSourcesPrompt,
  extractFieldValueSchemaDescription,
  generateEntitySearchQueriesPrompt,
  generateEntitySearchQueriesSchemaDescription,
  generateFieldQueriesSchemaDescription,
  generateFieldSearchQueriesPrompt,
} from "./prompts";
import tables from "./schema";

/**
 * Search and extract entities using Firecrawl with content scraping (Node.js only).
 * New strategy: Search with content → Extract entities from articles → Return entities.
 * Returns extracted entities without acquiring locks.
 * Should be called from a wrapper action in actions.ts that handles mutations.
 */
export const searchAndValidateEntities = internalAction({
  args: {
    query: v.string(),
    targetRows: v.number(),
  },
  handler: async (
    _ctx,
    args
  ): Promise<Array<{ name: string; url: string }>> => {
    // Over-fetch: Each search returns ~5 results, each result may contain multiple entities
    // Estimate: 3-5 entities per article (listicles, comparisons)
    const searchesNeeded = Math.max(2, Math.ceil(args.targetRows / 10));

    console.log("[SEARCH] Calculating searches needed:", {
      targetRows: args.targetRows,
      searchesNeeded,
    });

    // Step 1: Generate diverse search queries (if needed)
    let searchQueries: string[];

    if (searchesNeeded > 1) {
      console.log("[SEARCH] Generating diverse search queries with AI...");
      const { object } = await generateObject({
        model: model.languageModel("grok-4-fast-non-reasoning"),
        schema: z.object({
          queries: z.array(z.string()).min(searchesNeeded),
        }),
        schemaDescription: generateEntitySearchQueriesSchemaDescription(),
        experimental_repairText: async ({ text }) => jsonrepair(text),
        prompt: generateEntitySearchQueriesPrompt({
          query: args.query,
          count: searchesNeeded,
        }),
      });
      searchQueries = object.queries;
      console.log("[SEARCH] ✓ Queries generated:", searchQueries.length);
    } else {
      searchQueries = [args.query];
      console.log("[SEARCH] Using single query (no diversification needed)");
    }

    // Step 2: Search with content scraping (get markdown from results)
    console.log("[SEARCH] Searching web with Firecrawl...", {
      queries: searchQueries.length,
      limit: 2,
    });

    const searchResults = await Promise.allSettled(
      searchQueries.map((query) =>
        firecrawlApp.search(query, {
          limit: 2,
          sources: ["web"],
          scrapeOptions: {
            formats: ["markdown"],
            onlyMainContent: true,
          },
        })
      )
    );

    // Step 3: Collect scraped content from all search results
    const scrapedSources: Array<{
      sourceUrl: string;
      title: string;
      content: string;
    }> = [];

    for (const result of searchResults) {
      if (result.status === "rejected") {
        console.error("[SEARCH] ✗ Search failed:", result.reason);
        continue;
      }

      const searchData = result.value;
      const results = searchData.web || [];

      for (const item of results) {
        // Check if item has markdown content and URL
        if (
          "markdown" in item &&
          "url" in item &&
          typeof item.url === "string" &&
          item.markdown &&
          item.url
        ) {
          const itemTitle =
            "title" in item && typeof item.title === "string" ? item.title : "";

          // Use selectRelevantContent to extract most relevant parts
          const processedContent = selectRelevantContent({
            content: item.markdown,
            query: args.query,
            preserveStructure: true,
            maxLength: 2000,
          });

          scrapedSources.push({
            sourceUrl: item.url,
            title: itemTitle,
            content: processedContent,
          });
        }
      }
    }

    if (scrapedSources.length === 0) {
      console.error("[SEARCH] ✗ No scraped content available");
      return [];
    }

    console.log("[SEARCH] ✓ Scraped sources collected:", {
      count: scrapedSources.length,
    });

    // Step 4: Extract entities from scraped content with AI
    console.log("[AI] Extracting entities from scraped content...");
    const entities = await extractEntitiesFromContentWithAI(
      scrapedSources,
      args.query
    );

    console.log("[AI] ✓ Entities extracted:", {
      count: entities.length,
      entities: entities.map((e, i) => ({
        index: i + 1,
        name: e.name,
        url: e.url,
      })),
    });

    return entities;
  },
});

/**
 * Extract entities from scraped content using AI.
 * Analyzes article content to find entity mentions with their official URLs.
 */
async function extractEntitiesFromContentWithAI(
  scrapedSources: Array<{
    sourceUrl: string;
    title: string;
    content: string;
  }>,
  originalQuery: string
): Promise<Array<{ name: string; url: string }>> {
  if (scrapedSources.length === 0) {
    return [];
  }

  console.log(
    "scrapedSources",
    scrapedSources.map((s) => ({
      title: s.title,
      content: s.content.substring(0, 100),
      sourceUrl: s.sourceUrl,
    }))
  );

  // Single AI call to extract entities from all sources
  const result = await extractEntitiesWithRetry(
    scrapedSources,
    originalQuery,
    2
  );

  if (!result) {
    console.error("Entity extraction failed after retries");
    return [];
  }

  // Deduplicate by URL
  const entitiesMap = new Map<string, { name: string; url: string }>();

  for (const entity of result.entities) {
    if (!entitiesMap.has(entity.url)) {
      entitiesMap.set(entity.url, {
        name: entity.name,
        url: entity.url,
      });
    }
  }

  return Array.from(entitiesMap.values());
}

/**
 * Extract entities with automatic retry.
 */
async function extractEntitiesWithRetry(
  scrapedSources: Array<{
    sourceUrl: string;
    title: string;
    content: string;
  }>,
  originalQuery: string,
  maxRetries: number
): Promise<{
  entities: Array<{
    name: string;
    url: string;
    reasoning: string;
  }>;
} | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { object } = await generateObject({
        model: model.languageModel("grok-4-fast-non-reasoning"),
        schema: z.object({
          entities: z.array(
            z.object({
              name: z.string(),
              url: z.string(),
              reasoning: z.string(),
            })
          ),
        }),
        schemaDescription: extractEntitiesFromContentSchemaDescription(),
        experimental_repairText: async ({ text }) => jsonrepair(text),
        prompt: extractEntitiesFromContentPrompt({
          originalQuery,
          scrapedSources,
        }),
      });

      console.log("Extracted entities:", object.entities);

      return object;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `Entity extraction attempt ${attempt}/${maxRetries} failed:`,
        errorMessage
      );

      if (attempt < maxRetries) {
        const delayMs = 1000 * attempt;
        await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  return null;
}

/**
 * Scrape URLs and generate descriptions using AI.
 * Takes rowData and returns rowId-keyed descriptions.
 * Node.js only (uses Firecrawl).
 */
export const scrapeAndGenerateDescriptions = internalAction({
  args: {
    rowData: v.record(
      v.id("datasetRows"), // rowId as string key
      v.object({
        url: v.string(),
        entityName: v.string(),
      })
    ),
  },
  handler: async (_ctx, args): Promise<Record<Id<"datasetRows">, string>> => {
    const entries = Object.entries(args.rowData);

    if (entries.length === 0) {
      console.log("[SCRAPE] No entities to scrape");
      return {};
    }

    console.log("[SCRAPE] Scraping entity URLs...", {
      count: entries.length,
    });

    // Step 1: Scrape all URLs in parallel
    const scrapeResults = await Promise.allSettled(
      entries.map(async ([rowId, entity]) => {
        try {
          const scraped = await firecrawlApp.scrape(entity.url, {
            formats: ["markdown"],
            onlyMainContent: true,
          });

          // Process content to extract most relevant parts for descriptions
          const processedContent = selectRelevantContent({
            content: scraped.markdown || "",
            query: entity.entityName, // Use entity name for relevance
            preserveStructure: true, // Keep structure for descriptions
            maxLength: 3000, // More content for better descriptions
          });

          return {
            rowId,
            entityName: entity.entityName,
            url: entity.url,
            content: processedContent,
          };
        } catch (error) {
          console.error(`[SCRAPE] ✗ Failed for ${entity.url}:`, error);
          return {
            rowId,
            entityName: entity.entityName,
            url: entity.url,
            content: "", // Empty if scrape fails
          };
        }
      })
    );

    // Step 2: Extract fulfilled results
    const scrapedData: Array<{
      rowId: string;
      entityName: string;
      url: string;
      content: string;
    }> = [];

    for (const result of scrapeResults) {
      if (result.status === "fulfilled") {
        scrapedData.push(result.value);
      }
    }

    console.log("[SCRAPE] ✓ URLs scraped:", {
      successful: scrapedData.length,
      total: entries.length,
      withContent: scrapedData.filter((d) => d.content).length,
    });

    // Step 3: Generate descriptions with AI (single call)
    console.log("[AI] Generating descriptions for scraped content...");
    const result = await generateDescriptionsWithAI(scrapedData, 2);

    if (!result) {
      console.error(
        "[AI] ✗ Description generation failed - using empty descriptions"
      );
      // AI failed - return empty descriptions
      const fallback: Record<string, string> = {};
      for (const data of scrapedData) {
        fallback[data.rowId] = ""; // Empty, not hardcoded
      }
      return fallback;
    }

    console.log("[AI] ✓ Descriptions generated:", result.descriptions.length);

    // Step 4: Build rowId → description map
    const descriptions: Record<string, string> = {};

    for (const data of scrapedData) {
      // Find matching description by entityName
      const desc = result.descriptions.find((d) => d.name === data.entityName);
      descriptions[data.rowId] = desc?.description || ""; // Empty if not found

      // Log each description as it's mapped
      console.log(`[AI] ${data.entityName}:`, {
        description: desc?.description || "(empty)",
      });
    }

    return descriptions;
  },
});

/**
 * Generate descriptions with AI from scraped content (with retry).
 */
async function generateDescriptionsWithAI(
  scrapedData: Array<{
    entityName: string;
    url: string;
    content: string;
  }>,
  maxRetries: number
): Promise<{
  descriptions: Array<{
    name: string;
    description: string;
  }>;
} | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { object } = await generateObject({
        model: model.languageModel("grok-4-fast-non-reasoning"),
        schema: z.object({
          descriptions: z.array(
            z.object({
              name: z.string(),
              description: z.string(),
            })
          ),
        }),
        schemaDescription: extractDescriptionsSchemaDescription(),
        experimental_repairText: async ({ text }) => jsonrepair(text),
        prompt: extractDescriptionsFromContentPrompt({ scrapedData }),
      });

      return object;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `Description generation attempt ${attempt}/${maxRetries} failed:`,
        errorMessage
      );

      if (attempt < maxRetries) {
        const delayMs = 1000 * attempt;
        await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  return null;
}

// Type for field research result
type FieldResult = {
  fieldName: string;
  value: string | number | boolean | null;
  confidence: number;
  sourceCount: number;
  reasoning: string;
  citations: Array<{
    source: string;
    title?: string;
    excerpt?: string;
    confidence: number;
    reasoning: string;
    searchQuery?: string;
    retrievedAt: number;
    date?: string;
  }>;
};

/**
 * Research all columns for ONE row.
 * Pure research - NO database operations!
 * Returns all field results.
 */
export const researchRow = internalAction({
  args: {
    entity: v.object({
      name: v.string(),
      url: v.string(),
      description: v.string(),
    }),
    columns: v.array(
      v.object({
        ...tables.datasetColumns.validator.fields,
        datasetId: v.optional(v.id("datasets")),
      })
    ),
  },
  handler: async (_ctx, args): Promise<FieldResult[]> => {
    // Research all columns in parallel
    const fieldResults = await Promise.allSettled(
      args.columns.map((column) =>
        researchSingleFieldWithRetry(args.entity, column, 2)
      )
    );

    // Convert settled results to clean array
    const results: FieldResult[] = [];

    for (let i = 0; i < fieldResults.length; i++) {
      const result = fieldResults[i];
      const column = args.columns[i];

      if (!column) {
        continue;
      }

      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        // Column research failed - return null with error
        const errorMessage =
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason);

        console.error(
          `[RESEARCH] ✗ Field research failed for ${column.name}:`,
          errorMessage
        );

        results.push({
          fieldName: column.name,
          value: null,
          confidence: 0,
          sourceCount: 0,
          reasoning: `Research failed: ${errorMessage}`,
          citations: [],
        });
      }
    }

    return results;
  },
});

/**
 * Research single field with retry logic.
 */
async function researchSingleFieldWithRetry(
  entity: { name: string; url: string; description: string },
  column: {
    name: string;
    displayName: string;
    dataType: string;
    description?: string;
    unit?: string;
  },
  maxRetries: number
): Promise<FieldResult> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await researchSingleField(entity, column);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (attempt === maxRetries) {
        // All retries exhausted
        return {
          fieldName: column.name,
          value: null,
          confidence: 0,
          sourceCount: 0,
          reasoning: `Failed after ${maxRetries} attempts: ${errorMessage}`,
          citations: [],
        };
      }

      // Wait before retry (exponential backoff)
      await new Promise<void>((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }

  // Fallback (shouldn't reach here)
  return {
    fieldName: column.name,
    value: null,
    confidence: 0,
    sourceCount: 0,
    reasoning: "Failed",
    citations: [],
  };
}

/**
 * Deep research for ONE field.
 * Searches 3 queries with Firecrawl, extracts value with AI.
 */
async function researchSingleField(
  entity: { name: string; url: string; description: string },
  column: {
    name: string;
    displayName: string;
    dataType: string;
    description?: string;
    unit?: string;
  }
): Promise<FieldResult> {
  const currentDate = new Date().toISOString();

  // Step 1: Generate 3 search queries with AI
  const { object: queriesObj } = await generateObject({
    model: model.languageModel("grok-4-fast-non-reasoning"),
    schema: z.object({
      queries: z.array(z.string()).length(3),
    }),
    schemaDescription: generateFieldQueriesSchemaDescription(),
    experimental_repairText: async ({ text }) => jsonrepair(text),
    prompt: generateFieldSearchQueriesPrompt({
      entityName: entity.name,
      fieldName: column.displayName,
      fieldDescription: column.description,
      currentDate,
    }),
  });

  const queries = queriesObj.queries;

  // Step 2: Search all queries in parallel with Firecrawl
  const searchResults = await Promise.allSettled(
    queries.map((query) =>
      firecrawlApp.search(query, {
        limit: 2,
        sources: ["web"],
        scrapeOptions: {
          formats: ["markdown"],
          onlyMainContent: true,
        },
      })
    )
  );

  // Step 3: Collect and process sources
  const allSources: Array<{
    url: string;
    title: string;
    content: string;
    searchQuery: string;
  }> = [];

  for (let i = 0; i < searchResults.length; i++) {
    const result = searchResults[i];
    const query = queries[i];

    if (result.status === "rejected" || !query) {
      continue;
    }

    const searchData = result.value;
    const results = searchData.web || [];

    for (const item of results) {
      if (
        "markdown" in item &&
        "url" in item &&
        typeof item.url === "string" &&
        item.markdown &&
        item.url
      ) {
        const itemTitle =
          "title" in item && typeof item.title === "string" ? item.title : "";

        // Process content to extract most relevant parts
        const processedContent = selectRelevantContent({
          content: item.markdown,
          query: column.displayName, // Use field name for relevance
          preserveStructure: false, // Focus on relevance over structure
          maxLength: 2000, // Keep reasonable size for AI processing
        });

        allSources.push({
          url: item.url,
          title: itemTitle,
          content: processedContent,
          searchQuery: query,
        });
      }
    }
  }

  // No sources found
  if (allSources.length === 0) {
    return {
      fieldName: column.name,
      value: null,
      confidence: 0,
      sourceCount: 0,
      reasoning: `No sources found for ${column.displayName}`,
      citations: [],
    };
  }

  // Step 4: Extract value with AI
  const sourcesContext = allSources
    .map(
      (s, idx) =>
        `SOURCE ${idx + 1}: ${s.title}\nURL: ${s.url}\nContent: ${s.content}`
    )
    .join("\n\n---\n\n");

  const { object } = await generateObject({
    model: model.languageModel("grok-4-fast-non-reasoning"),
    schema: z.object({
      value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
      confidence: z.number().min(0).max(1),
      reasoning: z.string(),
      citations: z.array(
        z.object({
          sourceIndex: z.number(),
          excerpt: z.string(),
          confidence: z.number().min(0).max(1),
          date: z.string().optional(),
        })
      ),
    }),
    schemaDescription: extractFieldValueSchemaDescription(),
    experimental_repairText: async ({ text }) => jsonrepair(text),
    prompt: extractFieldValueFromSourcesPrompt({
      entityName: entity.name,
      fieldName: column.displayName,
      fieldType: column.dataType,
      fieldUnit: column.unit,
      sourcesContext,
      currentDate,
    }),
  });

  // Low confidence or no value
  if (object.value === null || object.confidence < 0.5) {
    return {
      fieldName: column.name,
      value: null,
      confidence: 0,
      sourceCount: allSources.length,
      reasoning: object.reasoning,
      citations: [],
    };
  }

  // Format citations
  const citations = object.citations.map((c) => ({
    source: allSources[c.sourceIndex]?.url || "",
    title: allSources[c.sourceIndex]?.title || "",
    excerpt: c.excerpt,
    confidence: c.confidence,
    reasoning: object.reasoning,
    searchQuery: allSources[c.sourceIndex]?.searchQuery,
    retrievedAt: Date.now(),
    date: c.date,
  }));

  return {
    fieldName: column.name,
    value: object.value,
    confidence: object.confidence,
    sourceCount: allSources.length,
    reasoning: object.reasoning,
    citations,
  };
}
