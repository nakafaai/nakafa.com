import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import {
  ninaContextSnapshotValidator,
  ninaContextTransitionValidator,
} from "@repo/backend/confect/chats/context";
import { nakafaDataValidator } from "@repo/backend/confect/chats/nakafa";
import { CHAT_GENERATION_FAILURE_CODES } from "@repo/backend/confect/nina/config/generation";
import {
  MODEL_IDS,
  ModelIdSchema,
} from "@repo/backend/confect/nina/config/model";
import {
  NinaContextSnapshotSchema,
  NinaContextTransitionSchema,
} from "@repo/backend/confect/nina/memory/pack";
import { mathOperations } from "@repo/math/schema/operations";
import { Schema, Struct } from "effect";
/**
 * Chat visibility validator
 */
export const chatVisibilityValidator = Schema.Literals(["private", "public"]);
export type ChatVisibility = Schema.Schema.Type<typeof chatVisibilityValidator>;

/**
 * Chat type validator
 */
export const chatTypeValidator = Schema.Literals(["study"]);

/**
 * Chat base validator (without system fields)
 */
export const chatValidator = Schema.Struct({
  threadId: Schema.optionalKey(Schema.String),
  activeTurnId: Schema.optionalKey(IdSchema("ninaTurns")),
  updatedAt: Schema.Finite,
  title: Schema.optionalKey(Schema.String),
  userId: IdSchema("users"),
  visibility: chatVisibilityValidator,
  type: chatTypeValidator,
});

/**
 * Chat document validator (with system fields)
 * Used internally for paginatedChatsValidator
 */

/**
 * Paginated chats validator
 */

/**
 * Message role validator
 */
export const messageRoleValidator = Schema.Literals([
  "user",
  "assistant",
  "system",
]);

/**
 * Message base validator (without system fields)
 */
/**
 * Model ID validator using literals for type safety.
 * References MODEL_IDS from @repo/backend/confect/nina/config/model for single source of truth.
 */
export const modelIdValueValidator = Schema.Literals([...MODEL_IDS]);
export const modelIdValidator = Schema.optionalKey(modelIdValueValidator);

/** Assistant generation lifecycle persisted for refresh-safe chat recovery. */
export const messageGenerationStatusValidator = Schema.Literals([
  "complete",
  "failed",
]);
export const messageGenerationErrorCodeValidator = Schema.Literals([
  ...CHAT_GENERATION_FAILURE_CODES,
]);

/** Stored chat message contract, including optional Nina context metadata. */
export const messageValidator = Schema.Struct({
  identifier: Schema.String,
  chatId: IdSchema("chats"),
  role: messageRoleValidator,
  inputTokens: Schema.optionalKey(Schema.Finite),
  outputTokens: Schema.optionalKey(Schema.Finite),
  totalTokens: Schema.optionalKey(Schema.Finite),
  credits: Schema.optionalKey(Schema.Finite),
  modelId: modelIdValidator,
  generationStatus: Schema.optionalKey(messageGenerationStatusValidator),
  generationErrorCode: Schema.optionalKey(messageGenerationErrorCodeValidator),
  ninaContextSnapshot: Schema.optionalKey(ninaContextSnapshotValidator),
  ninaContextTransition: Schema.optionalKey(ninaContextTransitionValidator),
});

/**
 * Message document validator (with system fields)
 * Used internally for messageWithPartsDocValidator
 */

/**
 * Chat-specific validators
 */
export const dataStatusValidator = Schema.Literals([
  "loading",
  "done",
  "error",
]);
export const streamStateValidator = Schema.Literals(["streaming", "done"]);
export const toolStateValidator = Schema.Literals([
  "input-streaming",
  "input-available",
  "output-available",
  "output-error",
]);
export type ToolState = Schema.Schema.Type<typeof toolStateValidator>;
export const partTypeValidator = Schema.Literals([
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
  "data-math",
  "data-scrape-url",
  "data-web-search",
]);
export const webSearchSourceValidator = Schema.Struct({
  title: Schema.String,
  description: Schema.String,
  url: Schema.String,
  content: Schema.String,
  citation: Schema.String,
});
export const webSearchProviderValidator = Schema.Literals([
  "firecrawl",
  "google",
]);
export const mathExpressionValidator = Schema.Struct({
  expression: Schema.String,
  latex: Schema.String,
});
export const mathOperationValidator = Schema.Literals([...mathOperations]);
export const mathStatusValidator = Schema.Literals([
  "verified",
  "contradicted",
  "inconclusive",
]);
export const mathStepStatusValidator = Schema.Literals([
  "complete",
  "partial",
  "unavailable",
]);
export const mathPointValidator = Schema.Struct({
  x: Schema.String,
  y: Schema.String,
});
export const mathProbabilityParametersValidator = Schema.Struct({
  lambda: Schema.optionalKey(Schema.String),
  lower: Schema.optionalKey(Schema.String),
  mean: Schema.optionalKey(Schema.String),
  n: Schema.optionalKey(Schema.String),
  p: Schema.optionalKey(Schema.String),
  standard_deviation: Schema.optionalKey(Schema.String),
  upper: Schema.optionalKey(Schema.String),
});
export const mathRequestValidator = Schema.Struct({
  distribution: Schema.optionalKey(Schema.String),
  expression: Schema.optionalKey(Schema.String),
  expressions: Schema.optionalKey(Schema.mutable(Schema.Array(Schema.String))),
  inclusive: Schema.optionalKey(Schema.Boolean),
  k: Schema.optionalKey(Schema.String),
  kind: Schema.Literal("math"),
  left: Schema.optionalKey(Schema.String),
  lower: Schema.optionalKey(Schema.String),
  lowerInclusive: Schema.optionalKey(Schema.Boolean),
  matrix: Schema.optionalKey(
    Schema.mutable(Schema.Array(Schema.mutable(Schema.Array(Schema.String))))
  ),
  modulus: Schema.optionalKey(Schema.String),
  n: Schema.optionalKey(Schema.String),
  operation: mathOperationValidator,
  order: Schema.optionalKey(Schema.Finite),
  parameters: Schema.optionalKey(mathProbabilityParametersValidator),
  point: Schema.optionalKey(Schema.String),
  points: Schema.optionalKey(Schema.mutable(Schema.Array(mathPointValidator))),
  right: Schema.optionalKey(Schema.String),
  right_matrix: Schema.optionalKey(
    Schema.mutable(Schema.Array(Schema.mutable(Schema.Array(Schema.String))))
  ),
  upper: Schema.optionalKey(Schema.String),
  upperInclusive: Schema.optionalKey(Schema.Boolean),
  values: Schema.optionalKey(Schema.mutable(Schema.Array(Schema.String))),
  variable: Schema.optionalKey(Schema.String),
  variables: Schema.optionalKey(Schema.mutable(Schema.Array(Schema.String))),
  vector: Schema.optionalKey(Schema.mutable(Schema.Array(Schema.String))),
});
export const mathItemValidator = Schema.Struct({
  label: Schema.String,
  latex: Schema.optionalKey(Schema.String),
  value: Schema.String,
});
export const mathStepValidator = Schema.Struct({
  action: Schema.String,
  items: Schema.mutable(Schema.Array(mathItemValidator)),
  primary: mathExpressionValidator,
  relation: Schema.optionalKey(mathExpressionValidator),
  secondary: Schema.optionalKey(mathExpressionValidator),
});
export const mathResultValidator = Schema.Struct({
  conditions: Schema.mutable(Schema.Array(mathExpressionValidator)),
  input: mathRequestValidator,
  items: Schema.mutable(Schema.Array(mathItemValidator)),
  kind: mathOperationValidator,
  operation: mathOperationValidator,
  primary: mathExpressionValidator,
  reason: Schema.String,
  secondary: Schema.optionalKey(mathExpressionValidator),
  stepStatus: mathStepStatusValidator,
  steps: Schema.mutable(Schema.Array(mathStepValidator)),
  status: mathStatusValidator,
});
const currentMathDataValidator = Schema.Union([
  Schema.Struct({
    kind: mathOperationValidator,
    status: Schema.Literal("loading"),
    input: mathRequestValidator,
  }),
  Schema.Struct({
    kind: mathOperationValidator,
    status: mathStatusValidator,
    input: mathRequestValidator,
    result: mathResultValidator,
    summary: Schema.String,
  }),
  Schema.Struct({
    kind: mathOperationValidator,
    status: Schema.Literal("error"),
    input: mathRequestValidator,
    error: Schema.String,
  }),
]);
export const mathDataValidator = currentMathDataValidator;

/**
 * Provider metadata persisted with chat parts.
 * AI SDK provider metadata can contain arbitrary JSON, but the chat transcript
 * only needs string continuation tokens and provider identifiers.
 */
export const providerMetadataObjectValidator = Schema.Record(
  Schema.String,
  Schema.Record(Schema.String, Schema.String)
);
export const providerMetadataValidator = Schema.optionalKey(
  providerMetadataObjectValidator
);
export type PersistedProviderMetadata = Schema.Schema.Type<
  typeof providerMetadataObjectValidator
>;
const specialistToolInputFields = {
  objective: Schema.String,
  request: Schema.String,
  requirements: Schema.optionalKey(Schema.mutable(Schema.Array(Schema.String))),
};
export const nakafaToolInputValidator = Schema.Struct({
  ...specialistToolInputFields,
  deliverables: Schema.mutable(Schema.Array(Schema.String)),
});
export const mathToolInputValidator = Schema.Struct({
  ...specialistToolInputFields,
  given: Schema.mutable(Schema.Array(Schema.String)),
});
export const researchToolInputValidator = Schema.Struct({
  ...specialistToolInputFields,
  sourceRequirements: Schema.mutable(Schema.Array(Schema.String)),
});

/**
 * Message part base validator without system fields.
 */
export const partValidator = Schema.Struct({
  messageId: IdSchema("messages"),
  type: partTypeValidator,
  order: Schema.Finite,
  textText: Schema.optionalKey(Schema.String),
  textState: Schema.optionalKey(streamStateValidator),
  reasoningText: Schema.optionalKey(Schema.String),
  reasoningState: Schema.optionalKey(streamStateValidator),
  fileMediaType: Schema.optionalKey(Schema.String),
  fileFilename: Schema.optionalKey(Schema.String),
  fileUrl: Schema.optionalKey(Schema.String),
  toolToolCallId: Schema.optionalKey(Schema.String),
  toolState: Schema.optionalKey(toolStateValidator),
  toolErrorText: Schema.optionalKey(Schema.String),
  toolCallProviderMetadata: providerMetadataValidator,
  toolResultProviderMetadata: providerMetadataValidator,
  // Nina LearningCapability tool fields
  toolNakafaInput: Schema.optionalKey(nakafaToolInputValidator),
  toolNakafaOutput: Schema.optionalKey(Schema.String),
  toolMathInput: Schema.optionalKey(mathToolInputValidator),
  toolMathOutput: Schema.optionalKey(Schema.String),
  toolDeepResearchInput: Schema.optionalKey(researchToolInputValidator),
  toolDeepResearchOutput: Schema.optionalKey(Schema.String),
  dataSuggestionsId: Schema.optionalKey(Schema.String),
  dataSuggestionsData: Schema.optionalKey(
    Schema.mutable(Schema.Array(Schema.String))
  ),
  dataNakafaId: Schema.optionalKey(Schema.String),
  dataNakafaData: Schema.optionalKey(nakafaDataValidator),
  dataMathId: Schema.optionalKey(Schema.String),
  dataMathData: Schema.optionalKey(mathDataValidator),
  dataScrapeUrlId: Schema.optionalKey(Schema.String),
  dataScrapeUrlUrl: Schema.optionalKey(Schema.String),
  dataScrapeUrlContent: Schema.optionalKey(Schema.String),
  dataScrapeUrlTitle: Schema.optionalKey(Schema.String),
  dataScrapeUrlDescription: Schema.optionalKey(Schema.String),
  dataScrapeUrlFavicon: Schema.optionalKey(Schema.String),
  dataScrapeUrlStatus: Schema.optionalKey(dataStatusValidator),
  dataScrapeUrlError: Schema.optionalKey(Schema.String),
  dataWebSearchId: Schema.optionalKey(Schema.String),
  dataWebSearchProvider: Schema.optionalKey(webSearchProviderValidator),
  dataWebSearchQueries: Schema.optionalKey(
    Schema.mutable(Schema.Array(Schema.String))
  ),
  dataWebSearchSources: Schema.optionalKey(
    Schema.mutable(Schema.Array(webSearchSourceValidator))
  ),
  dataWebSearchStatus: Schema.optionalKey(dataStatusValidator),
  dataWebSearchError: Schema.optionalKey(Schema.String),
  providerMetadata: providerMetadataValidator,
});

const ComponentUsageSchema = Schema.Struct({
  input: Schema.Finite,
  output: Schema.Finite,
}).mapFields(Struct.map(Schema.mutableKey));
/**
 * Metadata stored on Nina UI messages.
 */
const chatMessageMetadataValidator = Schema.Struct({
  credits: Schema.optional(Schema.Finite),
  generationErrorCode: Schema.optional(
    Schema.Literals(CHAT_GENERATION_FAILURE_CODES)
  ),
  generationStatus: Schema.optional(Schema.Literals(["complete", "failed"])),
  model: ModelIdSchema,
  ninaContextSnapshot: Schema.optional(NinaContextSnapshotSchema),
  ninaContextTransition: Schema.optional(NinaContextTransitionSchema),
  tokens: Schema.optional(
    Schema.Struct({
      breakdown: Schema.optional(
        Schema.Struct({
          main: ComponentUsageSchema,
          subAgents: Schema.Record(Schema.String, ComponentUsageSchema),
        }).mapFields(Struct.map(Schema.mutableKey))
      ),
      input: Schema.optional(Schema.Finite),
      output: Schema.optional(Schema.Finite),
      total: Schema.optional(Schema.Finite),
    }).mapFields(Struct.map(Schema.mutableKey))
  ),
}).mapFields(Struct.map(Schema.mutableKey));
export type ChatMessageMetadata = typeof chatMessageMetadataValidator.Type;
