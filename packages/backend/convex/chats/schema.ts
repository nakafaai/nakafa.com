import { defineTable, paginationResultValidator } from "convex/server";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import {
  addFieldsToValidator,
  literals,
  systemFields,
} from "convex-helpers/validators";
import {
  articleCategoryValidator,
  gradeValidator,
  localeValidator,
  materialValidator,
  subjectCategoryValidator,
} from "@/convex/lib/validators/contents";

/**
 * Re-export content validators for backward compatibility.
 * Import from lib/contentValidators directly in new code.
 */
export {
  gradeValidator,
  localeValidator,
  materialValidator,
  subjectCategoryValidator,
} from "@/convex/lib/validators/contents";

/**
 * Chat visibility validator
 */
export const chatVisibilityValidator = literals("private", "public");
export type ChatVisibility = Infer<typeof chatVisibilityValidator>;

/**
 * Chat type validator
 */
export const chatTypeValidator = literals("study", "finance");

/**
 * Chat base validator (without system fields)
 */
export const chatValidator = v.object({
  updatedAt: v.number(),
  title: v.optional(v.string()),
  userId: v.id("users"),
  visibility: chatVisibilityValidator,
  type: chatTypeValidator,
});

/**
 * Chat document validator (with system fields)
 * Used internally for paginatedChatsValidator
 */
const chatDocValidator = addFieldsToValidator(
  chatValidator,
  systemFields("chats")
);

/**
 * Paginated chats validator
 */
export const paginatedChatsValidator =
  paginationResultValidator(chatDocValidator);

/**
 * Message role validator
 */
export const messageRoleValidator = literals("user", "assistant", "system");

/**
 * Message base validator (without system fields)
 */
export const messageValidator = v.object({
  identifier: v.string(),
  chatId: v.id("chats"),
  role: messageRoleValidator,
});

/**
 * Message document validator (with system fields)
 * Used internally for messageWithPartsDocValidator
 */
const messageDocValidator = addFieldsToValidator(
  messageValidator,
  systemFields("messages")
);

/**
 * Chat-specific validators
 */
export const dataStatusValidator = literals("loading", "done", "error");

export const streamStateValidator = literals("streaming", "done");

export const toolStateValidator = literals(
  "input-streaming",
  "input-available",
  "output-available",
  "output-error",
  "output-denied",
  "approval-requested",
  "approval-responded"
);

export const partTypeValidator = literals(
  "text",
  "reasoning",
  "source-url",
  "source-document",
  "file",
  "step-start",
  "tool-getArticles",
  "tool-getSubjects",
  "tool-getContent",
  "tool-calculator",
  "tool-scrape",
  "tool-webSearch",
  "dynamic-tool",
  "data-suggestions",
  "data-get-articles",
  "data-get-subjects",
  "data-get-content",
  "data-calculator",
  "data-scrape-url",
  "data-web-search"
);

export const contentItemValidator = v.object({
  title: v.string(),
  url: v.string(),
  slug: v.string(),
  locale: v.string(),
});

export const webSearchSourceValidator = v.object({
  title: v.string(),
  description: v.string(),
  url: v.string(),
  content: v.string(),
  citation: v.string(),
});

export const calculatorExpressionValidator = v.object({
  expression: v.string(),
  latex: v.string(),
});

export const calculatorResultValidator = v.object({
  expression: v.string(),
  latex: v.string(),
  value: v.string(),
});

/**
 * Provider metadata validator.
 * Uses v.any() for the innermost value because this comes from AI SDK
 * and varies by provider (OpenAI, Anthropic, Google, etc.).
 * The shape is defined externally by each AI provider's SDK, not by us.
 */
export const providerMetadataValidator = v.optional(
  v.record(v.string(), v.record(v.string(), v.any()))
);

/**
 * Part base validator (without system fields)
 * Contains all fields for the parts table
 */
export const partValidator = v.object({
  messageId: v.id("messages"),
  type: partTypeValidator,
  order: v.number(),

  textText: v.optional(v.string()),
  textState: v.optional(streamStateValidator),

  reasoningText: v.optional(v.string()),
  reasoningState: v.optional(streamStateValidator),

  fileMediaType: v.optional(v.string()),
  fileFilename: v.optional(v.string()),
  fileUrl: v.optional(v.string()),

  sourceUrlSourceId: v.optional(v.string()),
  sourceUrlUrl: v.optional(v.string()),
  sourceUrlTitle: v.optional(v.string()),

  sourceDocumentSourceId: v.optional(v.string()),
  sourceDocumentMediaType: v.optional(v.string()),
  sourceDocumentTitle: v.optional(v.string()),
  sourceDocumentFilename: v.optional(v.string()),

  toolToolCallId: v.optional(v.string()),
  toolState: v.optional(toolStateValidator),
  toolErrorText: v.optional(v.string()),

  toolGetArticlesInputLocale: v.optional(localeValidator),
  toolGetArticlesInputCategory: v.optional(articleCategoryValidator),
  toolGetArticlesOutput: v.optional(v.string()),

  toolGetSubjectsInputLocale: v.optional(localeValidator),
  toolGetSubjectsInputCategory: v.optional(subjectCategoryValidator),
  toolGetSubjectsInputGrade: v.optional(gradeValidator),
  toolGetSubjectsInputMaterial: v.optional(materialValidator),
  toolGetSubjectsOutput: v.optional(v.string()),

  toolGetContentInputLocale: v.optional(localeValidator),
  toolGetContentInputSlug: v.optional(v.string()),
  toolGetContentOutput: v.optional(v.string()),

  toolCalculatorInputExpression: v.optional(v.string()),
  toolCalculatorOutput: v.optional(v.string()),

  toolScrapeUrlInputUrlToCrawl: v.optional(v.string()),
  toolScrapeUrlOutput: v.optional(v.string()),

  toolWebSearchInputQuery: v.optional(v.string()),
  toolWebSearchOutput: v.optional(v.string()),

  dataSuggestionsId: v.optional(v.string()),
  dataSuggestionsData: v.optional(v.array(v.string())),

  dataGetArticlesId: v.optional(v.string()),
  dataGetArticlesBaseUrl: v.optional(v.string()),
  dataGetArticlesInputLocale: v.optional(localeValidator),
  dataGetArticlesInputCategory: v.optional(articleCategoryValidator),
  dataGetArticlesArticles: v.optional(v.array(contentItemValidator)),
  dataGetArticlesStatus: v.optional(dataStatusValidator),
  dataGetArticlesError: v.optional(v.string()),

  dataGetSubjectsId: v.optional(v.string()),
  dataGetSubjectsBaseUrl: v.optional(v.string()),
  dataGetSubjectsInputLocale: v.optional(localeValidator),
  dataGetSubjectsInputCategory: v.optional(subjectCategoryValidator),
  dataGetSubjectsInputGrade: v.optional(gradeValidator),
  dataGetSubjectsInputMaterial: v.optional(materialValidator),
  dataGetSubjectsSubjects: v.optional(v.array(contentItemValidator)),
  dataGetSubjectsStatus: v.optional(dataStatusValidator),
  dataGetSubjectsError: v.optional(v.string()),

  dataGetContentId: v.optional(v.string()),
  dataGetContentUrl: v.optional(v.string()),
  dataGetContentTitle: v.optional(v.string()),
  dataGetContentDescription: v.optional(v.string()),
  dataGetContentStatus: v.optional(dataStatusValidator),
  dataGetContentError: v.optional(v.string()),

  dataCalculatorId: v.optional(v.string()),
  dataCalculatorOriginal: v.optional(calculatorExpressionValidator),
  dataCalculatorResult: v.optional(calculatorResultValidator),
  dataCalculatorStatus: v.optional(literals("done", "error")),
  dataCalculatorError: v.optional(v.string()),

  dataScrapeUrlId: v.optional(v.string()),
  dataScrapeUrlUrl: v.optional(v.string()),
  dataScrapeUrlContent: v.optional(v.string()),
  dataScrapeUrlStatus: v.optional(dataStatusValidator),
  dataScrapeUrlError: v.optional(v.string()),

  dataWebSearchId: v.optional(v.string()),
  dataWebSearchQuery: v.optional(v.string()),
  dataWebSearchSources: v.optional(v.array(webSearchSourceValidator)),
  dataWebSearchStatus: v.optional(dataStatusValidator),
  dataWebSearchError: v.optional(v.string()),

  providerMetadata: providerMetadataValidator,
});

/**
 * Part document validator (with system fields)
 * Used internally for messageWithPartsDocValidator
 */
const partDocValidator = addFieldsToValidator(
  partValidator,
  systemFields("parts")
);

/**
 * Message with parts document validator
 * Used for loadMessages return type - returns raw DB documents
 */
export const messageWithPartsDocValidator = messageDocValidator.extend({
  parts: v.array(partDocValidator),
});
export type MessageWithPartsDoc = Infer<typeof messageWithPartsDocValidator>;

export const tables = {
  chats: defineTable(chatValidator)
    .index("userId", ["userId"])
    .index("userId_visibility", ["userId", "visibility"])
    .index("userId_type", ["userId", "type"])
    .index("userId_visibility_type", ["userId", "visibility", "type"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["userId", "visibility", "type"],
    }),

  messages: defineTable(messageValidator)
    .index("chatId", ["chatId"])
    .index("chatId_identifier", ["chatId", "identifier"]),

  parts: defineTable(partValidator).index("messageId_order", [
    "messageId",
    "order",
  ]),
};

export default tables;
