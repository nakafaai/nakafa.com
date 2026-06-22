import type { Nakafa } from "@repo/ai/agents/nakafa/service";
import type { ModelId } from "@repo/ai/config/model";
import type { SourceReference } from "@repo/ai/lib/source";
import { NinaContextPackSchema } from "@repo/ai/nina/context";
import type { MyUIMessage } from "@repo/ai/types/message";
import { PromptUserRoleSchema } from "@repo/ai/types/roles";
import {
  CoverageStatusSchema,
  LearningInterestSchema,
  LearningPlanItemStatusSchema,
  LearningProgramKeySchema,
  LearningProgramKindSchema,
  LearningStageSchema,
} from "@repo/contents/_types/program/schema";
import type { Locale } from "@repo/utilities/locales";
import type { UIMessageStreamWriter } from "ai";
import { Schema } from "effect";

/** Program and plan context agents can use without Convex document coupling. */
export const AgentLearningProfileSchema = Schema.Struct({
  interests: Schema.Array(LearningInterestSchema),
  planItems: Schema.Array(
    Schema.Struct({
      content_id: Schema.String,
      lensId: Schema.String,
      position: Schema.Number,
      route: Schema.optional(Schema.String),
      status: LearningPlanItemStatusSchema,
      title: Schema.optional(Schema.String),
    }).pipe(Schema.mutable)
  ),
  program: Schema.Struct({
    coverageStatus: CoverageStatusSchema,
    key: LearningProgramKeySchema,
    kind: LearningProgramKindSchema,
    title: Schema.String,
    versionLabel: Schema.String,
  }).pipe(Schema.mutable),
  stage: Schema.optional(LearningStageSchema),
}).pipe(Schema.mutable);

export type AgentLearningProfile = Schema.Schema.Type<
  typeof AgentLearningProfileSchema
>;

/** Per-turn context shared by Nina and specialist agents after harness arbitration. */
export const AgentContextSchema = Schema.Struct({
  currentDate: Schema.String,
  learningProfile: Schema.optional(AgentLearningProfileSchema),
  needsPageFetch: Schema.Boolean,
  nina: Schema.optional(NinaContextPackSchema),
  slug: Schema.String,
  url: Schema.String,
  userRole: Schema.optional(PromptUserRoleSchema),
  verified: Schema.Boolean,
}).pipe(Schema.mutable);

export type AgentContext = Schema.Schema.Type<typeof AgentContextSchema>;

/**
 * AI SDK adapter parameters shared by all specialist agents.
 *
 * Durable fields derive from Effect schemas; the writer remains the external AI
 * SDK UI-message stream Interface that tool callbacks require.
 */
export interface BaseAgentParams {
  context: AgentContext;
  locale: Locale;
  modelId: ModelId;
  writer: UIMessageStreamWriter<MyUIMessage>;
}

/** AI SDK adapter parameters for specialists that receive a tool task string. */
export interface TaskAgentParams extends BaseAgentParams {
  task: string;
}

/** Parameters for the Nakafa content retrieval subagent. */
export interface NakafaAgentParams extends TaskAgentParams {
  nakafa: Nakafa;
}

/** Parameters for the external research subagent. */
export interface ResearchAgentParams extends BaseAgentParams {
  sourceReferences: SourceReference[];
  task: string;
  toolCallId: string;
}

/** Alias used by the deterministic math specialist adapter. */
export type MathAgentParams = TaskAgentParams;
