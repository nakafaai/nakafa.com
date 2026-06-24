import { CHAT_GENERATION_FAILURE_CODES } from "@repo/ai/config/generation";
import { MODEL_IDS } from "@repo/ai/config/model";
import {
  ninaContextSnapshotValidator,
  ninaContextTransitionValidator,
} from "@repo/backend/convex/chats/context";
import { capabilityTraceValidator } from "@repo/backend/convex/chats/traces/spec";
import {
  contentSearchInputValidator,
  contentSearchRefValidator,
  contentSearchResultValidator,
} from "@repo/backend/convex/contents/helpers/search/schema";
import {
  localeValidator,
  nakafaSectionValidator,
} from "@repo/backend/convex/lib/validators/contents";
import {
  mathReasoningDataValidator,
  mathRequestValidator,
} from "@repo/backend/convex/math/spec";
import { defineTable, paginationResultValidator } from "convex/server";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import {
  addFieldsToValidator,
  literals,
  systemFields,
} from "convex-helpers/validators";

/**
 * Chat visibility validator
 */
export const chatVisibilityValidator = literals("private", "public");
export type ChatVisibility = Infer<typeof chatVisibilityValidator>;

/**
 * Chat type validator
 */
export const chatTypeValidator = literals("study");

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
/**
 * Model ID validator using literals for type safety.
 * References MODEL_IDS from @repo/ai/config/model for single source of truth.
 */
export const modelIdValueValidator = literals(...MODEL_IDS);
export const modelIdValidator = v.optional(modelIdValueValidator);

/** Assistant generation lifecycle persisted for refresh-safe chat recovery. */
export const messageGenerationStatusValidator = literals("complete", "failed");
export const messageGenerationErrorCodeValidator = literals(
  ...CHAT_GENERATION_FAILURE_CODES
);

/** Stored chat message contract, including optional Nina context metadata. */
export const messageValidator = v.object({
  identifier: v.string(),
  chatId: v.id("chats"),
  role: messageRoleValidator,
  inputTokens: v.optional(v.number()),
  outputTokens: v.optional(v.number()),
  totalTokens: v.optional(v.number()),
  credits: v.optional(v.number()),
  modelId: modelIdValidator,
  generationStatus: v.optional(messageGenerationStatusValidator),
  generationErrorCode: v.optional(messageGenerationErrorCodeValidator),
  ninaContextSnapshot: v.optional(ninaContextSnapshotValidator),
  ninaContextTransition: v.optional(ninaContextTransitionValidator),
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
  "output-error"
);
export type ToolState = Infer<typeof toolStateValidator>;

export const partTypeValidator = literals(
  "text",
  "reasoning",
  "file",
  "step-start",
  // Nina LearningCapability tools
  "tool-nakafa",
  "tool-deepResearch",
  "tool-math",
  // Data parts
  "data-suggestions",
  "data-nakafa",
  "data-math-reasoning",
  "data-scrape-url",
  "data-web-search"
);

export const nakafaReadInputValidator = v.object({
  content_ref: v.string(),
});

export const nakafaExerciseInputValidator = v.object({
  content_ref: v.string(),
  exercise_number: v.optional(v.number()),
});

export const nakafaQuranInputValidator = v.object({
  from_verse: v.number(),
  include_tafsir: v.boolean(),
  locale: localeValidator,
  surah: v.number(),
  to_verse: v.optional(v.number()),
});

export const nakafaTaxonomyInputValidator = v.object({
  locale: localeValidator,
});

export const nakafaContentPreviewValidator = v.object({
  ...contentSearchRefValidator.fields,
  description: v.string(),
  title: v.string(),
});

export const nakafaExercisePreviewValidator = v.object({
  ...contentSearchRefValidator.fields,
  count: v.number(),
  exercise_number: v.optional(v.number()),
  numbers: v.array(v.number()),
  title: v.string(),
});

export const nakafaQuranPreviewValidator = v.object({
  ...contentSearchRefValidator.fields,
  from_verse: v.number(),
  name: v.string(),
  revelation: v.string(),
  to_verse: v.number(),
  translation: v.string(),
  verse_count: v.number(),
});

export const nakafaTaxonomyPreviewValidator = v.object({
  content_counts: v.array(
    v.object({
      count: v.number(),
      locale: localeValidator,
    })
  ),
  locale: localeValidator,
  sections: v.array(nakafaSectionValidator),
  tools: v.array(v.string()),
});

export const nakafaDataValidator = v.union(
  v.object({
    kind: v.literal("search"),
    status: v.literal("loading"),
    input: contentSearchInputValidator,
  }),
  v.object({
    kind: v.literal("search"),
    status: v.literal("done"),
    input: contentSearchInputValidator,
    result: contentSearchResultValidator,
  }),
  v.object({
    kind: v.literal("search"),
    status: v.literal("error"),
    input: contentSearchInputValidator,
    error: v.string(),
  }),
  v.object({
    kind: v.literal("content"),
    status: v.literal("loading"),
    input: nakafaReadInputValidator,
  }),
  v.object({
    kind: v.literal("content"),
    status: v.literal("done"),
    input: nakafaReadInputValidator,
    result: nakafaContentPreviewValidator,
  }),
  v.object({
    kind: v.literal("content"),
    status: v.literal("error"),
    input: nakafaReadInputValidator,
    error: v.string(),
  }),
  v.object({
    kind: v.literal("exercise"),
    status: v.literal("loading"),
    input: nakafaExerciseInputValidator,
  }),
  v.object({
    kind: v.literal("exercise"),
    status: v.literal("done"),
    input: nakafaExerciseInputValidator,
    result: nakafaExercisePreviewValidator,
  }),
  v.object({
    kind: v.literal("exercise"),
    status: v.literal("error"),
    input: nakafaExerciseInputValidator,
    error: v.string(),
  }),
  v.object({
    kind: v.literal("quran"),
    status: v.literal("loading"),
    input: nakafaQuranInputValidator,
  }),
  v.object({
    kind: v.literal("quran"),
    status: v.literal("done"),
    input: nakafaQuranInputValidator,
    result: nakafaQuranPreviewValidator,
  }),
  v.object({
    kind: v.literal("quran"),
    status: v.literal("error"),
    input: nakafaQuranInputValidator,
    error: v.string(),
  }),
  v.object({
    kind: v.literal("taxonomy"),
    status: v.literal("loading"),
    input: nakafaTaxonomyInputValidator,
  }),
  v.object({
    kind: v.literal("taxonomy"),
    status: v.literal("done"),
    input: nakafaTaxonomyInputValidator,
    result: nakafaTaxonomyPreviewValidator,
  }),
  v.object({
    kind: v.literal("taxonomy"),
    status: v.literal("error"),
    input: nakafaTaxonomyInputValidator,
    error: v.string(),
  })
);

export const webSearchSourceValidator = v.object({
  title: v.string(),
  description: v.string(),
  url: v.string(),
  content: v.string(),
  citation: v.string(),
});

export const webSearchProviderValidator = literals("firecrawl", "google");

/**
 * Provider metadata persisted with chat parts.
 * AI SDK provider metadata can contain arbitrary JSON, but the chat transcript
 * only needs string continuation tokens and provider identifiers.
 */
export const providerMetadataObjectValidator = v.record(
  v.string(),
  v.record(v.string(), v.string())
);
export const providerMetadataValidator = v.optional(
  providerMetadataObjectValidator
);
export type PersistedProviderMetadata = Infer<
  typeof providerMetadataObjectValidator
>;

const specialistToolInputFields = {
  objective: v.string(),
  request: v.string(),
  requirements: v.optional(v.array(v.string())),
};

export const nakafaToolInputValidator = v.object({
  ...specialistToolInputFields,
  deliverables: v.array(v.string()),
});

/** Structured deterministic math tool input persisted with chat tool parts. */
export const mathToolInputValidator = v.object({
  ...specialistToolInputFields,
  given: v.array(v.string()),
  math: mathRequestValidator,
});

export const researchToolInputValidator = v.object({
  ...specialistToolInputFields,
  sourceRequirements: v.array(v.string()),
});

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

  toolToolCallId: v.optional(v.string()),
  toolState: v.optional(toolStateValidator),
  toolErrorText: v.optional(v.string()),
  toolCallProviderMetadata: providerMetadataValidator,
  toolResultProviderMetadata: providerMetadataValidator,

  // Nina LearningCapability tool fields
  toolNakafaInput: v.optional(nakafaToolInputValidator),
  toolNakafaOutput: v.optional(v.string()),
  toolMathInput: v.optional(mathToolInputValidator),
  toolMathOutput: v.optional(v.string()),
  toolDeepResearchInput: v.optional(researchToolInputValidator),
  toolDeepResearchOutput: v.optional(v.string()),

  dataSuggestionsId: v.optional(v.string()),
  dataSuggestionsData: v.optional(v.array(v.string())),

  dataNakafaId: v.optional(v.string()),
  dataNakafaData: v.optional(nakafaDataValidator),

  dataMathReasoningId: v.optional(v.string()),
  dataMathReasoningData: v.optional(mathReasoningDataValidator),

  dataScrapeUrlId: v.optional(v.string()),
  dataScrapeUrlUrl: v.optional(v.string()),
  dataScrapeUrlContent: v.optional(v.string()),
  dataScrapeUrlTitle: v.optional(v.string()),
  dataScrapeUrlDescription: v.optional(v.string()),
  dataScrapeUrlFavicon: v.optional(v.string()),
  dataScrapeUrlStatus: v.optional(dataStatusValidator),
  dataScrapeUrlError: v.optional(v.string()),

  dataWebSearchId: v.optional(v.string()),
  dataWebSearchProvider: v.optional(webSearchProviderValidator),
  dataWebSearchQueries: v.optional(v.array(v.string())),
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
 * Used for chat transcript query results - returns raw DB documents
 */
export const messageWithPartsDocValidator = messageDocValidator.extend({
  parts: v.array(partDocValidator),
});
export type MessageWithPartsDoc = Infer<typeof messageWithPartsDocValidator>;

/** Paginated chat transcript validator. */
export const paginatedMessagesValidator = paginationResultValidator(
  messageWithPartsDocValidator
);

export const tables = {
  chats: defineTable(chatValidator)
    .index("by_userId", ["userId"])
    .index("by_userId_and_visibility", ["userId", "visibility"])
    .index("by_userId_and_type", ["userId", "type"])
    .index("by_userId_and_visibility_and_type", [
      "userId",
      "visibility",
      "type",
    ])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["userId", "visibility", "type"],
    }),

  messages: defineTable(messageValidator)
    .index("by_chatId", ["chatId"])
    .index("by_chatId_and_identifier", ["chatId", "identifier"])
    .index("by_role", ["role"]),

  parts: defineTable(partValidator).index("by_messageId_and_order", [
    "messageId",
    "order",
  ]),

  ninaCapabilityTraces: defineTable(capabilityTraceValidator)
    .index("by_chatId_and_startedAt", ["chatId", "startedAt"])
    .index("by_chatId_and_responseMessageIdentifier_and_startedAt", [
      "chatId",
      "responseMessageIdentifier",
      "startedAt",
    ])
    .index("by_capability_and_startedAt", ["capability", "startedAt"])
    .index("by_status_and_startedAt", ["status", "startedAt"])
    .index("by_expiresAt", ["expiresAt"]),
};

export default tables;
