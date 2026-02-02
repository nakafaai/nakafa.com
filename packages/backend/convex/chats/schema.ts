import { defineTable, paginationResultValidator } from "convex/server";
import type { Infer } from "convex/values";
import { v } from "convex/values";

/**
 * Chat visibility validator
 */
export const chatVisibility = v.union(
  v.literal("private"),
  v.literal("public")
);
export type ChatVisibility = Infer<typeof chatVisibility>;

/**
 * Chat type validator
 */
export const chatTypeValidator = v.union(
  v.literal("study"),
  v.literal("finance")
);
export type ChatType = Infer<typeof chatTypeValidator>;

/**
 * Chat base validator (without system fields)
 */
export const chatValidator = v.object({
  updatedAt: v.number(),
  title: v.optional(v.string()),
  userId: v.id("users"),
  visibility: chatVisibility,
  type: chatTypeValidator,
});

/**
 * Chat document validator (with system fields)
 */
export const chatDocValidator = chatValidator.extend({
  _id: v.id("chats"),
  _creationTime: v.number(),
});
export type ChatDoc = Infer<typeof chatDocValidator>;

/**
 * Paginated chats validator
 */
export const paginatedChatsValidator =
  paginationResultValidator(chatDocValidator);

/**
 * Message role validator
 */
export const messageRoleValidator = v.union(
  v.literal("user"),
  v.literal("assistant"),
  v.literal("system")
);

/**
 * UI Message validator for loadMessages return type.
 *
 * Note: The `parts` field uses v.array(v.any()) because the AI SDK's UIMessagePart
 * type has 20+ variants with complex conditional fields (text, reasoning, file,
 * source-url, source-document, step-start, tool-*, data-*). Creating explicit
 * validators for all variants would add ~500 lines with minimal benefit since:
 * 1. TypeScript already ensures type safety via mapDBPartToUIMessagePart
 * 2. The data originates from our own DB with validated schema
 * 3. Runtime validation happens in the mapping functions
 */
export const uiMessageValidator = v.object({
  id: v.string(),
  role: messageRoleValidator,
  parts: v.array(v.any()),
});

export const tables = {
  chats: defineTable({
    updatedAt: v.number(), // Unix timestamp for last message
    title: v.optional(v.string()), // Optional chat title
    userId: v.id("users"), // Optional user association
    visibility: chatVisibility,
    type: v.union(v.literal("study"), v.literal("finance")),
  })
    // Each index needed for different filter + _creationTime sorting:
    // - userId: all chats sorted by _creationTime
    // - userId_visibility: filter visibility, sort by _creationTime
    // - userId_type: filter type, sort by _creationTime
    // - userId_visibility_type: filter both, sort by _creationTime
    .index("userId", ["userId"])
    .index("userId_visibility", ["userId", "visibility"])
    .index("userId_type", ["userId", "type"])
    .index("userId_visibility_type", ["userId", "visibility", "type"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["userId", "visibility", "type"],
    }),

  messages: defineTable({
    identifier: v.string(), // Unique identifier for the message https://ai-sdk.dev/docs/reference/ai-sdk-core/ui-message#uimessage-interface
    chatId: v.id("chats"), // Reference to chats table
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system")
    ),
  })
    .index("chatId", ["chatId"])
    .index("identifier", ["identifier"]),

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

      // Tool Part type (matches AI SDK tool names)
      v.literal("tool-getArticles"),
      v.literal("tool-getSubjects"),
      v.literal("tool-getContent"),
      v.literal("tool-calculator"),
      v.literal("tool-scrape"),
      v.literal("tool-webSearch"),
      v.literal("dynamic-tool"),

      // Data Part type
      v.literal("data-suggestions"),
      v.literal("data-get-articles"),
      v.literal("data-get-subjects"),
      v.literal("data-get-content"),
      v.literal("data-calculator"),
      v.literal("data-scrape-url"),
      v.literal("data-web-search")
    ),
    order: v.number(), // Order within message (0-based)

    // Text fields
    textText: v.optional(v.string()),
    textState: v.optional(v.union(v.literal("streaming"), v.literal("done"))),

    // Reasoning fields
    reasoningText: v.optional(v.string()),
    reasoningState: v.optional(
      v.union(v.literal("streaming"), v.literal("done"))
    ),

    // File fields
    fileMediaType: v.optional(v.string()),
    fileFilename: v.optional(v.string()),
    fileUrl: v.optional(v.string()),

    // Source URL fields
    sourceUrlSourceId: v.optional(v.string()),
    sourceUrlUrl: v.optional(v.string()),
    sourceUrlTitle: v.optional(v.string()),

    // Source document fields
    sourceDocumentSourceId: v.optional(v.string()),
    sourceDocumentMediaType: v.optional(v.string()),
    sourceDocumentTitle: v.optional(v.string()),
    sourceDocumentFilename: v.optional(v.string()),

    // Shared tool call columns
    toolToolCallId: v.optional(v.string()),
    toolState: v.optional(
      v.union(
        v.literal("input-streaming"),
        v.literal("input-available"),
        v.literal("output-available"),
        v.literal("output-error"),
        v.literal("output-denied"),
        v.literal("approval-requested"),
        v.literal("approval-responded")
      )
    ),
    toolErrorText: v.optional(v.string()),

    toolGetArticlesInputLocale: v.optional(
      v.union(v.literal("en"), v.literal("id"))
    ),
    toolGetArticlesInputCategory: v.optional(v.literal("politics")),
    toolGetArticlesOutput: v.optional(v.string()),

    toolGetSubjectsInputLocale: v.optional(
      v.union(v.literal("en"), v.literal("id"))
    ),
    toolGetSubjectsInputCategory: v.optional(
      v.union(
        v.literal("elementary-school"),
        v.literal("middle-school"),
        v.literal("high-school"),
        v.literal("university")
      )
    ),
    toolGetSubjectsInputGrade: v.optional(
      v.union(
        v.literal("1"),
        v.literal("2"),
        v.literal("3"),
        v.literal("4"),
        v.literal("5"),
        v.literal("6"),
        v.literal("7"),
        v.literal("8"),
        v.literal("9"),
        v.literal("10"),
        v.literal("11"),
        v.literal("12"),
        v.literal("bachelor"),
        v.literal("master"),
        v.literal("phd")
      )
    ),
    toolGetSubjectsInputMaterial: v.optional(
      v.union(
        v.literal("mathematics"),
        v.literal("physics"),
        v.literal("chemistry"),
        v.literal("biology"),
        v.literal("geography"),
        v.literal("economy"),
        v.literal("history"),
        v.literal("informatics"),
        v.literal("geospatial"),
        v.literal("sociology"),
        v.literal("ai-ds"),
        v.literal("game-engineering"),
        v.literal("computer-science"),
        v.literal("technology-electro-medical"),
        v.literal("political-science"),
        v.literal("informatics-engineering"),
        v.literal("international-relations")
      )
    ),
    toolGetSubjectsOutput: v.optional(v.string()),

    toolGetContentInputLocale: v.optional(
      v.union(v.literal("en"), v.literal("id"))
    ),
    toolGetContentInputSlug: v.optional(v.string()),
    toolGetContentOutput: v.optional(v.string()),

    toolCalculatorInputExpression: v.optional(v.string()),
    toolCalculatorOutput: v.optional(v.string()),

    toolScrapeUrlInputUrlToCrawl: v.optional(v.string()),
    toolScrapeUrlOutput: v.optional(v.string()),

    toolWebSearchInputQuery: v.optional(v.string()),
    toolWebSearchOutput: v.optional(v.string()),

    // Data part fields
    dataSuggestionsId: v.optional(v.string()),
    dataSuggestionsData: v.optional(v.array(v.string())),

    dataGetArticlesId: v.optional(v.string()),
    dataGetArticlesBaseUrl: v.optional(v.string()),
    dataGetArticlesInputLocale: v.optional(
      v.union(v.literal("en"), v.literal("id"))
    ),
    dataGetArticlesInputCategory: v.optional(v.literal("politics")),
    dataGetArticlesArticles: v.optional(
      v.array(
        v.object({
          title: v.string(),
          url: v.string(),
          slug: v.string(),
          locale: v.string(),
        })
      )
    ),
    dataGetArticlesStatus: v.optional(
      v.union(v.literal("loading"), v.literal("done"), v.literal("error"))
    ),
    dataGetArticlesError: v.optional(v.string()),

    dataGetSubjectsId: v.optional(v.string()),
    dataGetSubjectsBaseUrl: v.optional(v.string()),
    dataGetSubjectsInputLocale: v.optional(
      v.union(v.literal("en"), v.literal("id"))
    ),
    dataGetSubjectsInputCategory: v.optional(
      v.union(
        v.literal("elementary-school"),
        v.literal("middle-school"),
        v.literal("high-school"),
        v.literal("university")
      )
    ),
    dataGetSubjectsInputGrade: v.optional(
      v.union(
        v.literal("1"),
        v.literal("2"),
        v.literal("3"),
        v.literal("4"),
        v.literal("5"),
        v.literal("6"),
        v.literal("7"),
        v.literal("8"),
        v.literal("9"),
        v.literal("10"),
        v.literal("11"),
        v.literal("12"),
        v.literal("bachelor"),
        v.literal("master"),
        v.literal("phd")
      )
    ),
    dataGetSubjectsInputMaterial: v.optional(
      v.union(
        v.literal("mathematics"),
        v.literal("physics"),
        v.literal("chemistry"),
        v.literal("biology"),
        v.literal("geography"),
        v.literal("economy"),
        v.literal("history"),
        v.literal("informatics"),
        v.literal("geospatial"),
        v.literal("sociology"),
        v.literal("ai-ds"),
        v.literal("game-engineering"),
        v.literal("computer-science"),
        v.literal("technology-electro-medical"),
        v.literal("political-science"),
        v.literal("informatics-engineering"),
        v.literal("international-relations")
      )
    ),
    dataGetSubjectsSubjects: v.optional(
      v.array(
        v.object({
          title: v.string(),
          url: v.string(),
          slug: v.string(),
          locale: v.string(),
        })
      )
    ),
    dataGetSubjectsStatus: v.optional(
      v.union(v.literal("loading"), v.literal("done"), v.literal("error"))
    ),
    dataGetSubjectsError: v.optional(v.string()),

    dataGetContentId: v.optional(v.string()),
    dataGetContentUrl: v.optional(v.string()),
    dataGetContentTitle: v.optional(v.string()),
    dataGetContentDescription: v.optional(v.string()),
    dataGetContentStatus: v.optional(
      v.union(v.literal("loading"), v.literal("done"), v.literal("error"))
    ),
    dataGetContentError: v.optional(v.string()),

    dataCalculatorId: v.optional(v.string()),
    dataCalculatorOriginal: v.optional(
      v.object({
        expression: v.string(),
        latex: v.string(),
      })
    ),
    dataCalculatorResult: v.optional(
      v.object({
        expression: v.string(),
        latex: v.string(),
        value: v.string(),
      })
    ),
    dataCalculatorStatus: v.optional(
      v.union(v.literal("done"), v.literal("error"))
    ),
    dataCalculatorError: v.optional(v.string()),

    dataScrapeUrlId: v.optional(v.string()),
    dataScrapeUrlUrl: v.optional(v.string()),
    dataScrapeUrlContent: v.optional(v.string()),
    dataScrapeUrlStatus: v.optional(
      v.union(v.literal("loading"), v.literal("done"), v.literal("error"))
    ),
    dataScrapeUrlError: v.optional(v.string()),

    dataWebSearchId: v.optional(v.string()),
    dataWebSearchQuery: v.optional(v.string()),
    dataWebSearchSources: v.optional(
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
    dataWebSearchStatus: v.optional(
      v.union(v.literal("loading"), v.literal("done"), v.literal("error"))
    ),
    dataWebSearchError: v.optional(v.string()),

    /**
     * Provider metadata for AI provider-specific data.
     * Uses v.any() because this comes from the AI SDK and varies by provider:
     * - OpenAI: { openai: { logprobs, ... } }
     * - Anthropic: { anthropic: { cacheCreationInputTokens, ... } }
     * - etc.
     * The shape is defined by each AI provider's SDK, not by us.
     */
    providerMetadata: v.optional(
      v.record(v.string(), v.record(v.string(), v.any()))
    ),
  })
    // Single index covers: eq("messageId") OR eq("messageId").eq("order")
    .index("messageId_order", ["messageId", "order"]),
};

export default tables;
