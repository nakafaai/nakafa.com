import type { Nakafa } from "@repo/ai/agents/nakafa/service";
import { ModelIdSchema } from "@repo/ai/config/model";
import { SourceReferenceSchema } from "@repo/ai/lib/source";
import { NinaContextPackSchema } from "@repo/ai/nina/memory/pack";
import type { MyUIMessage } from "@repo/ai/types/message";
import { PromptUserRoleSchema } from "@repo/ai/types/roles";
import { LocaleSchema } from "@repo/contents/_types/content";
import {
  CoverageStatusSchema,
  LearningInterestSchema,
  LearningPlanItemStatusSchema,
  LearningProgramKeySchema,
  LearningProgramKindSchema,
  LearningStageSchema,
} from "@repo/contents/_types/program/schema";
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

/** Schema-derived data passed to task-oriented specialist agents. */
export const TaskAgentDataSchema = Schema.Struct({
  context: AgentContextSchema,
  locale: LocaleSchema,
  modelId: ModelIdSchema,
  task: Schema.String,
}).pipe(Schema.mutable);

type TaskAgentData = Schema.Schema.Type<typeof TaskAgentDataSchema>;
type SpecialistWriter = UIMessageStreamWriter<MyUIMessage>;

/** Parameters for the deterministic math specialist Adapter. */
export type MathAgentParams = TaskAgentData & {
  readonly writer: SpecialistWriter;
};

/** Parameters for the Nakafa content retrieval specialist Adapter. */
export type NakafaAgentParams = TaskAgentData & {
  readonly nakafa: Nakafa;
  readonly writer: SpecialistWriter;
};

/** Schema-derived data passed to the external research specialist. */
export const ResearchAgentDataSchema = Schema.Struct({
  context: AgentContextSchema,
  locale: LocaleSchema,
  modelId: ModelIdSchema,
  sourceReferences: Schema.Array(SourceReferenceSchema),
  task: Schema.String,
  toolCallId: Schema.String,
}).pipe(Schema.mutable);

/** Parameters for the external research specialist Adapter. */
export type ResearchAgentParams = Schema.Schema.Type<
  typeof ResearchAgentDataSchema
> & {
  readonly writer: SpecialistWriter;
};
