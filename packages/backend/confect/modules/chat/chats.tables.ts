import { GenericId } from "@confect/core";
import { Table } from "@confect/server";
import { MODEL_IDS } from "@repo/ai/config/models";
import { providerMetadataSchema } from "@repo/backend/confect/modules/chat/providerMetadata.schemas";
import {
  localeSchema,
  nakafaSectionSchema,
} from "@repo/backend/confect/modules/content/content.schemas";
import {
  contentSearchInputSchema,
  contentSearchRefSchema,
  contentSearchResultSchema,
} from "@repo/backend/confect/modules/content/search.schemas";
import { mathOperations } from "@repo/math/schema/operations";
import { Schema } from "effect";

/**
 * Chat visibility validator
 */
export const chatVisibilitySchema = Schema.Literal("private", "public");

export type ChatVisibility = Schema.Schema.Type<typeof chatVisibilitySchema>;

/**
 * Chat type validator
 */
export const chatTypeSchema = Schema.Literal("study");

/**
 * Chat base validator (without system fields)
 */
export const chatSchema = Schema.Struct({
  updatedAt: Schema.Number,
  title: Schema.optional(Schema.String),
  userId: GenericId.GenericId("users"),
  visibility: chatVisibilitySchema,
  type: chatTypeSchema,
});

/**
 * Message role validator
 */
export const messageRoleSchema = Schema.Literal("user", "assistant", "system");

/**
 * Message base validator (without system fields)
 */
/**
 * Model ID validator using literals for type safety.
 * References MODEL_IDS from @repo/ai/config/models for single source of truth.
 */
export const modelIdSchema = Schema.optional(Schema.Literal(...MODEL_IDS));

export const messageSchema = Schema.Struct({
  identifier: Schema.String,
  chatId: GenericId.GenericId("chats"),
  role: messageRoleSchema,
  inputTokens: Schema.optional(Schema.Number),
  outputTokens: Schema.optional(Schema.Number),
  totalTokens: Schema.optional(Schema.Number),
  credits: Schema.optional(Schema.Number),
  modelId: modelIdSchema,
});

/**
 * Chat-specific validators
 */
export const dataStatusSchema = Schema.Literal("loading", "done", "error");

export const streamStateSchema = Schema.Literal("streaming", "done");

export const toolStateSchema = Schema.Literal(
  "input-streaming",
  "input-available",
  "output-available",
  "output-error"
);

export type ToolState = Schema.Schema.Type<typeof toolStateSchema>;

export const partTypeSchema = Schema.Literal(
  "text",
  "reasoning",
  "file",
  "step-start",
  "tool-nakafa",
  "tool-deepResearch",
  "tool-math",
  "data-suggestions",
  "data-nakafa",
  "data-math",
  "data-scrape-url",
  "data-web-search"
);

export const nakafaReadInputSchema = Schema.Struct({
  content_ref: Schema.String,
});

export const nakafaExerciseInputSchema = Schema.Struct({
  content_ref: Schema.String,
  exercise_number: Schema.optional(Schema.Number),
});

export const nakafaQuranInputSchema = Schema.Struct({
  from_verse: Schema.Number,
  include_tafsir: Schema.Boolean,
  locale: localeSchema,
  surah: Schema.Number,
  to_verse: Schema.optional(Schema.Number),
});

export const nakafaTaxonomyInputSchema = Schema.Struct({
  locale: localeSchema,
});

export const nakafaContentPreviewSchema = Schema.Struct({
  ...contentSearchRefSchema.fields,
  description: Schema.String,
  title: Schema.String,
});

export const nakafaExercisePreviewSchema = Schema.Struct({
  ...contentSearchRefSchema.fields,
  count: Schema.Number,
  exercise_number: Schema.Union(Schema.Number, Schema.Null),
  numbers: Schema.Array(Schema.Number),
  title: Schema.String,
});

export const nakafaQuranPreviewSchema = Schema.Struct({
  ...contentSearchRefSchema.fields,
  from_verse: Schema.Number,
  name: Schema.String,
  revelation: Schema.String,
  to_verse: Schema.Number,
  translation: Schema.String,
  verse_count: Schema.Number,
});

export const nakafaTaxonomyPreviewSchema = Schema.Struct({
  content_counts: Schema.Array(
    Schema.Struct({ count: Schema.Number, locale: localeSchema })
  ),
  locale: localeSchema,
  sections: Schema.Array(nakafaSectionSchema),
  tools: Schema.Array(Schema.String),
});

export const nakafaDataSchema = Schema.Union(
  Schema.Struct({
    kind: Schema.Literal("search"),
    status: Schema.Literal("loading"),
    input: contentSearchInputSchema,
  }),
  Schema.Struct({
    kind: Schema.Literal("search"),
    status: Schema.Literal("done"),
    input: contentSearchInputSchema,
    result: contentSearchResultSchema,
  }),
  Schema.Struct({
    kind: Schema.Literal("search"),
    status: Schema.Literal("error"),
    input: contentSearchInputSchema,
    error: Schema.String,
  }),
  Schema.Struct({
    kind: Schema.Literal("content"),
    status: Schema.Literal("loading"),
    input: nakafaReadInputSchema,
  }),
  Schema.Struct({
    kind: Schema.Literal("content"),
    status: Schema.Literal("done"),
    input: nakafaReadInputSchema,
    result: nakafaContentPreviewSchema,
  }),
  Schema.Struct({
    kind: Schema.Literal("content"),
    status: Schema.Literal("error"),
    input: nakafaReadInputSchema,
    error: Schema.String,
  }),
  Schema.Struct({
    kind: Schema.Literal("exercise"),
    status: Schema.Literal("loading"),
    input: nakafaExerciseInputSchema,
  }),
  Schema.Struct({
    kind: Schema.Literal("exercise"),
    status: Schema.Literal("done"),
    input: nakafaExerciseInputSchema,
    result: nakafaExercisePreviewSchema,
  }),
  Schema.Struct({
    kind: Schema.Literal("exercise"),
    status: Schema.Literal("error"),
    input: nakafaExerciseInputSchema,
    error: Schema.String,
  }),
  Schema.Struct({
    kind: Schema.Literal("quran"),
    status: Schema.Literal("loading"),
    input: nakafaQuranInputSchema,
  }),
  Schema.Struct({
    kind: Schema.Literal("quran"),
    status: Schema.Literal("done"),
    input: nakafaQuranInputSchema,
    result: nakafaQuranPreviewSchema,
  }),
  Schema.Struct({
    kind: Schema.Literal("quran"),
    status: Schema.Literal("error"),
    input: nakafaQuranInputSchema,
    error: Schema.String,
  }),
  Schema.Struct({
    kind: Schema.Literal("taxonomy"),
    status: Schema.Literal("loading"),
    input: nakafaTaxonomyInputSchema,
  }),
  Schema.Struct({
    kind: Schema.Literal("taxonomy"),
    status: Schema.Literal("done"),
    input: nakafaTaxonomyInputSchema,
    result: nakafaTaxonomyPreviewSchema,
  }),
  Schema.Struct({
    kind: Schema.Literal("taxonomy"),
    status: Schema.Literal("error"),
    input: nakafaTaxonomyInputSchema,
    error: Schema.String,
  })
);

export const webSearchSourceSchema = Schema.Struct({
  title: Schema.String,
  description: Schema.String,
  url: Schema.String,
  content: Schema.String,
  citation: Schema.String,
});

export const webSearchProviderSchema = Schema.Literal("firecrawl", "google");

export const mathExpressionSchema = Schema.Struct({
  expression: Schema.String,
  latex: Schema.String,
});

export const mathOperationSchema = Schema.Literal(...mathOperations);

export const mathStatusSchema = Schema.Literal(
  "verified",
  "contradicted",
  "inconclusive"
);

export const mathStepStatusSchema = Schema.Literal(
  "complete",
  "partial",
  "unavailable"
);

export const mathPointSchema = Schema.Struct({
  x: Schema.String,
  y: Schema.String,
});

export const mathProbabilityParametersSchema = Schema.Struct({
  lambda: Schema.optional(Schema.String),
  lower: Schema.optional(Schema.String),
  mean: Schema.optional(Schema.String),
  n: Schema.optional(Schema.String),
  p: Schema.optional(Schema.String),
  standard_deviation: Schema.optional(Schema.String),
  upper: Schema.optional(Schema.String),
});

export const mathRequestSchema = Schema.Struct({
  distribution: Schema.optional(Schema.String),
  expression: Schema.optional(Schema.String),
  expressions: Schema.optional(Schema.Array(Schema.String)),
  inclusive: Schema.optional(Schema.Boolean),
  k: Schema.optional(Schema.String),
  kind: Schema.Literal("math"),
  left: Schema.optional(Schema.String),
  lower: Schema.optional(Schema.String),
  lowerInclusive: Schema.optional(Schema.Boolean),
  matrix: Schema.optional(Schema.Array(Schema.Array(Schema.String))),
  modulus: Schema.optional(Schema.String),
  n: Schema.optional(Schema.String),
  operation: mathOperationSchema,
  order: Schema.optional(Schema.Number),
  parameters: Schema.optional(mathProbabilityParametersSchema),
  point: Schema.optional(Schema.String),
  points: Schema.optional(Schema.Array(mathPointSchema)),
  right: Schema.optional(Schema.String),
  right_matrix: Schema.optional(Schema.Array(Schema.Array(Schema.String))),
  upper: Schema.optional(Schema.String),
  upperInclusive: Schema.optional(Schema.Boolean),
  values: Schema.optional(Schema.Array(Schema.String)),
  variable: Schema.optional(Schema.String),
  variables: Schema.optional(Schema.Array(Schema.String)),
  vector: Schema.optional(Schema.Array(Schema.String)),
});

export const mathItemSchema = Schema.Struct({
  label: Schema.String,
  latex: Schema.optional(Schema.String),
  value: Schema.String,
});

export const mathStepSchema = Schema.Struct({
  action: Schema.String,
  items: Schema.Array(mathItemSchema),
  primary: mathExpressionSchema,
  relation: Schema.optional(mathExpressionSchema),
  secondary: Schema.optional(mathExpressionSchema),
});

export const mathResultSchema = Schema.Struct({
  conditions: Schema.Array(mathExpressionSchema),
  input: mathRequestSchema,
  items: Schema.Array(mathItemSchema),
  kind: mathOperationSchema,
  operation: mathOperationSchema,
  primary: mathExpressionSchema,
  reason: Schema.String,
  secondary: Schema.optional(mathExpressionSchema),
  stepStatus: mathStepStatusSchema,
  steps: Schema.Array(mathStepSchema),
  status: mathStatusSchema,
});

const currentMathDataSchema = Schema.Union(
  Schema.Struct({
    kind: mathOperationSchema,
    status: Schema.Literal("loading"),
    input: mathRequestSchema,
  }),
  Schema.Struct({
    kind: mathOperationSchema,
    status: mathStatusSchema,
    input: mathRequestSchema,
    result: mathResultSchema,
    summary: Schema.String,
  }),
  Schema.Struct({
    kind: mathOperationSchema,
    status: Schema.Literal("error"),
    input: mathRequestSchema,
    error: Schema.String,
  })
);

export const mathDataSchema = currentMathDataSchema;

const optionalProviderMetadataSchema = Schema.optional(providerMetadataSchema);

const specialistToolInputFields = {
  objective: Schema.String,
  request: Schema.String,
  requirements: Schema.optional(Schema.Array(Schema.String)),
};

export const nakafaToolInputSchema = Schema.Struct({
  ...specialistToolInputFields,
  deliverables: Schema.Array(Schema.String),
});

export const mathToolInputSchema = Schema.Struct({
  ...specialistToolInputFields,
  given: Schema.Array(Schema.String),
});

export const researchToolInputSchema = Schema.Struct({
  ...specialistToolInputFields,
  sourceRequirements: Schema.Array(Schema.String),
});

/**
 * Part base validator (without system fields)
 * Contains all fields for the parts table
 */
export const partSchema = Schema.Struct({
  messageId: GenericId.GenericId("messages"),
  type: partTypeSchema,
  order: Schema.Number,
  textText: Schema.optional(Schema.String),
  textState: Schema.optional(streamStateSchema),
  reasoningText: Schema.optional(Schema.String),
  reasoningState: Schema.optional(streamStateSchema),
  fileMediaType: Schema.optional(Schema.String),
  fileFilename: Schema.optional(Schema.String),
  fileUrl: Schema.optional(Schema.String),
  toolToolCallId: Schema.optional(Schema.String),
  toolState: Schema.optional(toolStateSchema),
  toolErrorText: Schema.optional(Schema.String),
  toolCallProviderMetadata: optionalProviderMetadataSchema,
  toolResultProviderMetadata: optionalProviderMetadataSchema,
  toolNakafaInput: Schema.optional(nakafaToolInputSchema),
  toolNakafaOutput: Schema.optional(Schema.String),
  toolMathInput: Schema.optional(mathToolInputSchema),
  toolMathOutput: Schema.optional(Schema.String),
  toolDeepResearchInput: Schema.optional(researchToolInputSchema),
  toolDeepResearchOutput: Schema.optional(Schema.String),
  dataSuggestionsId: Schema.optional(Schema.String),
  dataSuggestionsData: Schema.optional(Schema.Array(Schema.String)),
  dataNakafaId: Schema.optional(Schema.String),
  dataNakafaData: Schema.optional(nakafaDataSchema),
  dataMathId: Schema.optional(Schema.String),
  dataMathData: Schema.optional(mathDataSchema),
  dataScrapeUrlId: Schema.optional(Schema.String),
  dataScrapeUrlUrl: Schema.optional(Schema.String),
  dataScrapeUrlContent: Schema.optional(Schema.String),
  dataScrapeUrlTitle: Schema.optional(Schema.String),
  dataScrapeUrlDescription: Schema.optional(Schema.String),
  dataScrapeUrlFavicon: Schema.optional(Schema.String),
  dataScrapeUrlStatus: Schema.optional(dataStatusSchema),
  dataScrapeUrlError: Schema.optional(Schema.String),
  dataWebSearchId: Schema.optional(Schema.String),
  dataWebSearchProvider: Schema.optional(webSearchProviderSchema),
  dataWebSearchQueries: Schema.optional(Schema.Array(Schema.String)),
  dataWebSearchSources: Schema.optional(Schema.Array(webSearchSourceSchema)),
  dataWebSearchStatus: Schema.optional(dataStatusSchema),
  dataWebSearchError: Schema.optional(Schema.String),
  providerMetadata: optionalProviderMetadataSchema,
});

/** Message part input accepted before message id and order are assigned. */
export const messagePartInputSchema = partSchema.omit("messageId", "order");

export type MessagePartInput = Schema.Schema.Type<
  typeof messagePartInputSchema
>;

/** chats table definition. */
export const Chats = Table.make("chats", chatSchema)
  .index("by_userId", ["userId"])
  .index("by_userId_and_visibility", ["userId", "visibility"])
  .index("by_userId_and_type", ["userId", "type"])
  .index("by_userId_and_visibility_and_type", ["userId", "visibility", "type"])
  .searchIndex("search_title", {
    searchField: "title",
    filterFields: ["userId", "visibility", "type"],
  });

/** messages table definition. */
export const Messages = Table.make("messages", messageSchema)
  .index("by_chatId", ["chatId"])
  .index("by_chatId_and_identifier", ["chatId", "identifier"]);

/** parts table definition. */
export const Parts = Table.make("parts", partSchema).index(
  "by_messageId_and_order",
  ["messageId", "order"]
);

export const tables = [Chats, Messages, Parts] as const;
