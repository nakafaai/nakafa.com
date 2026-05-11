import { MODEL_IDS } from "@repo/ai/config/models";
import {
  contentSearchInputValidator,
  contentSearchRefValidator,
  contentSearchResultValidator,
} from "@repo/backend/convex/contents/search/schema";
import {
  localeValidator,
  nakafaSectionValidator,
} from "@repo/backend/convex/lib/validators/contents";
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
 * References MODEL_IDS from @repo/ai/config/models for single source of truth.
 */
export const modelIdValidator = v.optional(literals(...MODEL_IDS));

export const messageValidator = v.object({
  identifier: v.string(),
  chatId: v.id("chats"),
  role: messageRoleValidator,
  inputTokens: v.optional(v.number()),
  outputTokens: v.optional(v.number()),
  totalTokens: v.optional(v.number()),
  credits: v.optional(v.number()),
  modelId: modelIdValidator,
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
  "source-url",
  "source-document",
  "file",
  "step-start",
  // Orchestrator tools
  "tool-nakafa",
  "tool-deepResearch",
  "tool-math",
  // Data parts
  "data-suggestions",
  "data-nakafa",
  "data-math",
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
  exercise_number: v.union(v.number(), v.null()),
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

export const mathExpressionValidator = v.object({
  expression: v.string(),
  latex: v.string(),
});

export const mathOperationValidator = literals(
  "apart",
  "cancel",
  "circle",
  "combination",
  "compare",
  "determinant",
  "differentiate",
  "distance",
  "distribution",
  "domain",
  "eigenvalues",
  "eigenvectors",
  "evaluate",
  "expected_value",
  "expand",
  "factor",
  "gcd",
  "integrate",
  "intersection",
  "inverse",
  "is_prime",
  "lcm",
  "limit",
  "line",
  "linear_system",
  "matrix_multiply",
  "mean",
  "median",
  "midpoint",
  "mode",
  "modular",
  "permutation",
  "prime_factorization",
  "product",
  "quartiles",
  "rank",
  "rationalize",
  "roots",
  "rref",
  "series",
  "simplify",
  "slope",
  "solve",
  "standard_deviation",
  "summation",
  "together",
  "variance",
  "variance_probability",
  "z_score"
);

export const mathStatusValidator = literals(
  "verified",
  "contradicted",
  "inconclusive"
);

export const mathStepStatusValidator = literals(
  "complete",
  "partial",
  "unavailable"
);

export const mathPointValidator = v.object({
  x: v.string(),
  y: v.string(),
});

export const mathRequestValidator = v.object({
  distribution: v.optional(v.string()),
  expression: v.optional(v.string()),
  expressions: v.optional(v.array(v.string())),
  k: v.optional(v.string()),
  kind: v.literal("math"),
  left: v.optional(v.string()),
  lower: v.optional(v.string()),
  matrix: v.optional(v.array(v.array(v.string()))),
  modulus: v.optional(v.string()),
  n: v.optional(v.string()),
  operation: mathOperationValidator,
  order: v.optional(v.number()),
  parameters: v.optional(v.record(v.string(), v.string())),
  point: v.optional(v.string()),
  points: v.optional(v.array(mathPointValidator)),
  right: v.optional(v.string()),
  right_matrix: v.optional(v.array(v.array(v.string()))),
  upper: v.optional(v.string()),
  values: v.optional(v.array(v.string())),
  variable: v.optional(v.string()),
  variables: v.optional(v.array(v.string())),
  vector: v.optional(v.array(v.string())),
});

const previousMathEvaluateInputValidator = v.object({
  expression: v.string(),
});

const previousMathSimplifyInputValidator = v.object({
  expression: v.string(),
});

const previousMathDifferentiateInputValidator = v.object({
  expression: v.string(),
  variable: v.string(),
});

const previousMathCompareInputValidator = v.object({
  left: v.string(),
  right: v.string(),
});

const previousMathSampleValidator = v.object({
  left: v.string(),
  right: v.string(),
  scope: v.record(v.string(), v.number()),
});

const previousMathCompareResultValidator = v.object({
  left: mathExpressionValidator,
  reason: v.string(),
  right: mathExpressionValidator,
  samples: v.array(previousMathSampleValidator),
  status: mathStatusValidator,
});

export const mathItemValidator = v.object({
  label: v.string(),
  latex: v.optional(v.string()),
  value: v.string(),
});

export const mathStepValidator = v.object({
  action: v.string(),
  items: v.array(mathItemValidator),
  primary: mathExpressionValidator,
  relation: v.optional(mathExpressionValidator),
  secondary: v.optional(mathExpressionValidator),
});

const legacyCurrentMathResultValidator = v.object({
  conditions: v.array(v.string()),
  input: mathRequestValidator,
  items: v.array(mathItemValidator),
  kind: mathOperationValidator,
  operation: mathOperationValidator,
  primary: mathExpressionValidator,
  reason: v.string(),
  secondary: v.optional(mathExpressionValidator),
  status: mathStatusValidator,
});

export const mathResultValidator = v.object({
  conditions: v.array(mathExpressionValidator),
  input: mathRequestValidator,
  items: v.array(mathItemValidator),
  kind: mathOperationValidator,
  operation: mathOperationValidator,
  primary: mathExpressionValidator,
  reason: v.string(),
  secondary: v.optional(mathExpressionValidator),
  stepStatus: mathStepStatusValidator,
  steps: v.array(mathStepValidator),
  status: mathStatusValidator,
});

const currentMathDataValidator = v.union(
  v.object({
    kind: mathOperationValidator,
    status: v.literal("loading"),
    input: mathRequestValidator,
  }),
  v.object({
    kind: mathOperationValidator,
    status: mathStatusValidator,
    input: mathRequestValidator,
    result: v.union(mathResultValidator, legacyCurrentMathResultValidator),
    summary: v.string(),
  }),
  v.object({
    kind: mathOperationValidator,
    status: v.literal("error"),
    input: mathRequestValidator,
    error: v.string(),
  })
);

const previousMathDataValidator = v.union(
  v.object({
    kind: v.literal("evaluate"),
    status: v.literal("loading"),
    input: previousMathEvaluateInputValidator,
  }),
  v.object({
    kind: v.literal("evaluate"),
    status: v.literal("verified"),
    input: previousMathEvaluateInputValidator,
    result: v.object({
      input: mathExpressionValidator,
      output: v.object({
        expression: v.string(),
        latex: v.string(),
        value: v.string(),
      }),
    }),
    summary: v.string(),
  }),
  v.object({
    kind: v.literal("evaluate"),
    status: v.literal("error"),
    input: previousMathEvaluateInputValidator,
    error: v.string(),
  }),
  v.object({
    kind: v.literal("simplify"),
    status: v.literal("loading"),
    input: previousMathSimplifyInputValidator,
  }),
  v.object({
    kind: v.literal("simplify"),
    status: v.literal("verified"),
    input: previousMathSimplifyInputValidator,
    result: v.object({
      input: mathExpressionValidator,
      output: mathExpressionValidator,
    }),
    summary: v.string(),
  }),
  v.object({
    kind: v.literal("simplify"),
    status: v.literal("error"),
    input: previousMathSimplifyInputValidator,
    error: v.string(),
  }),
  v.object({
    kind: v.literal("differentiate"),
    status: v.literal("loading"),
    input: previousMathDifferentiateInputValidator,
  }),
  v.object({
    kind: v.literal("differentiate"),
    status: v.literal("verified"),
    input: previousMathDifferentiateInputValidator,
    result: v.object({
      input: mathExpressionValidator,
      output: mathExpressionValidator,
      variable: v.string(),
    }),
    summary: v.string(),
  }),
  v.object({
    kind: v.literal("differentiate"),
    status: v.literal("error"),
    input: previousMathDifferentiateInputValidator,
    error: v.string(),
  }),
  v.object({
    kind: v.literal("compare"),
    status: v.literal("loading"),
    input: previousMathCompareInputValidator,
  }),
  v.object({
    kind: v.literal("compare"),
    status: mathStatusValidator,
    input: previousMathCompareInputValidator,
    result: previousMathCompareResultValidator,
    summary: v.string(),
  }),
  v.object({
    kind: v.literal("compare"),
    status: v.literal("error"),
    input: previousMathCompareInputValidator,
    error: v.string(),
  })
);

export const mathDataValidator = v.union(
  currentMathDataValidator,
  previousMathDataValidator
);

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

  // Orchestrator tool fields
  toolNakafaInput: v.optional(v.string()),
  toolNakafaOutput: v.optional(v.string()),
  toolMathInput: v.optional(v.string()),
  toolMathOutput: v.optional(v.string()),
  toolDeepResearchInput: v.optional(v.string()),
  toolDeepResearchOutput: v.optional(v.string()),

  dataSuggestionsId: v.optional(v.string()),
  dataSuggestionsData: v.optional(v.array(v.string())),

  dataNakafaId: v.optional(v.string()),
  dataNakafaData: v.optional(nakafaDataValidator),

  dataMathId: v.optional(v.string()),
  dataMathData: v.optional(mathDataValidator),

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
    .index("by_chatId_and_identifier", ["chatId", "identifier"]),

  parts: defineTable(partValidator).index("by_messageId_and_order", [
    "messageId",
    "order",
  ]),
};

export default tables;
