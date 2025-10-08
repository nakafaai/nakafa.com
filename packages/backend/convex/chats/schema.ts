import { defineTable } from "convex/server";
import { v } from "convex/values";

export const tables = {
  chats: defineTable({
    createdAt: v.number(), // Unix timestamp
    updatedAt: v.number(), // Unix timestamp for last message
    title: v.optional(v.string()), // Optional chat title
    userId: v.id("users"), // Optional user association
  })
    .index("userId", ["userId"])
    .index("createdAt", ["createdAt"])
    .index("updatedAt", ["updatedAt"]),

  messages: defineTable({
    chatId: v.id("chats"), // Reference to chats table
    createdAt: v.number(), // Unix timestamp
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system")
    ),
  })
    .index("chatId", ["chatId"])
    .index("chatId_createdAt", ["chatId", "createdAt"]),

  parts: defineTable({
    messageId: v.id("messages"), // Reference to messages table
    type: v.union(
      // Default part types
      v.literal("text"),
      v.literal("reasoning"),
      v.literal("source-url"),
      v.literal("source-document"),
      v.literal("file"),
      v.literal("step-start"),

      // Tool Part type
      v.literal("tool-get-articles"),
      v.literal("tool-get-subjects"),
      v.literal("tool-get-content"),
      v.literal("tool-calculator"),
      v.literal("tool-scrape-url"),
      v.literal("tool-web-search"),

      // Data Part type
      v.literal("data-suggestions"),
      v.literal("data-get-articles"),
      v.literal("data-get-subjects"),
      v.literal("data-get-content"),
      v.literal("data-calculator"),
      v.literal("data-scrape-url"),
      v.literal("data-web-search")
    ),
    createdAt: v.number(), // Unix timestamp
    order: v.number(), // Order within message (0-based)

    // Text fields
    text_text: v.optional(v.string()),

    // Reasoning fields
    reasoning_text: v.optional(v.string()),

    // File fields
    file_mediaType: v.optional(v.string()),
    file_filename: v.optional(v.string()),
    file_url: v.optional(v.string()),

    // Source URL fields
    source_url_sourceId: v.optional(v.string()),
    source_url_url: v.optional(v.string()),
    source_url_title: v.optional(v.string()),

    // Source document fields
    source_document_sourceId: v.optional(v.string()),
    source_document_mediaType: v.optional(v.string()),
    source_document_title: v.optional(v.string()),
    source_document_filename: v.optional(v.string()),

    // Shared tool call columns
    tool_toolCallId: v.optional(v.string()),
    tool_state: v.optional(
      v.union(
        v.literal("input-streaming"),
        v.literal("input-available"),
        v.literal("output-available"),
        v.literal("output-error")
      )
    ),
    tool_errorText: v.optional(v.string()),

    // Data part fields
    data_suggestions_id: v.optional(v.string()),
    data_suggestions_data: v.optional(v.array(v.string())),

    data_get_articles_id: v.optional(v.string()),
    data_get_articles_baseUrl: v.optional(v.string()),
    data_get_articles_articles: v.optional(
      v.array(
        v.object({
          title: v.string(),
          url: v.string(),
          slug: v.string(),
          locale: v.string(),
        })
      )
    ),
    data_get_articles_status: v.optional(
      v.union(v.literal("loading"), v.literal("done"), v.literal("error"))
    ),
    data_get_articles_error: v.optional(v.string()),

    data_get_subjects_id: v.optional(v.string()),
    data_get_subjects_baseUrl: v.optional(v.string()),
    data_get_subjects_subjects: v.optional(
      v.array(
        v.object({
          title: v.string(),
          url: v.string(),
          slug: v.string(),
          locale: v.string(),
        })
      )
    ),
    data_get_subjects_status: v.optional(
      v.union(v.literal("loading"), v.literal("done"), v.literal("error"))
    ),
    data_get_subjects_error: v.optional(v.string()),

    data_get_content_id: v.optional(v.string()),
    data_get_content_url: v.optional(v.string()),
    data_get_content_title: v.optional(v.string()),
    data_get_content_description: v.optional(v.string()),
    data_get_content_content: v.optional(v.string()),
    data_get_content_status: v.optional(
      v.union(v.literal("loading"), v.literal("done"), v.literal("error"))
    ),
    data_get_content_error: v.optional(v.string()),

    data_calculator_id: v.optional(v.string()),
    data_calculator_original: v.optional(
      v.object({
        expression: v.string(),
        latex: v.string(),
      })
    ),
    data_calculator_result: v.optional(
      v.object({
        expression: v.string(),
        latex: v.string(),
        value: v.string(),
      })
    ),
    data_calculator_status: v.optional(
      v.union(v.literal("done"), v.literal("error"))
    ),
    data_calculator_error: v.optional(v.string()),

    data_scrape_url_id: v.optional(v.string()),
    data_scrape_url_url: v.optional(v.string()),
    data_scrape_url_content: v.optional(v.string()),
    data_scrape_url_status: v.optional(
      v.union(v.literal("loading"), v.literal("done"), v.literal("error"))
    ),
    data_scrape_url_error: v.optional(v.string()),

    data_web_search_id: v.optional(v.string()),
    data_web_search_query: v.optional(v.string()),
    data_web_search_sources: v.optional(
      v.array(
        v.object({
          title: v.string(),
          description: v.string(),
          url: v.string(),
          content: v.string(),
          citation: v.string(),
        })
      )
    ),
    data_web_search_status: v.optional(
      v.union(v.literal("loading"), v.literal("done"), v.literal("error"))
    ),
    data_web_search_error: v.optional(v.string()),

    // Provider metadata (flexible for AI provider-specific data)
    providerMetadata: v.optional(
      v.object({
        model: v.optional(v.string()),
        tokens: v.optional(
          v.object({
            input: v.optional(v.number()),
            output: v.optional(v.number()),
            total: v.optional(v.number()),
          })
        ),
        cost: v.optional(v.number()),
        latency: v.optional(v.number()),
        provider: v.optional(v.string()),
      })
    ),
  })
    .index("messageId", ["messageId"])
    .index("messageId_order", ["messageId", "order"])
    .index("type", ["type"])
    .index("createdAt", ["createdAt"]),
};

export default tables;
