import {
  LearningProgramKeySchema,
  LearningProgramKindSchema,
  ProgramCoverageSchema,
} from "@nakafa/aksara-contracts/program/spec";
import type { Nakafa } from "@repo/ai/agents/nakafa/service";
import { ModelIdSchema } from "@repo/ai/config/model";
import { SourceReferenceSchema } from "@repo/ai/lib/source";
import { NinaContextPackSchema } from "@repo/ai/nina/memory/pack";
import type { MyUIMessage } from "@repo/ai/types/message";
import { PromptUserRoleSchema } from "@repo/ai/types/roles";
import { LocaleSchema } from "@repo/contents/_types/content";
import { LearningInterestSchema } from "@repo/contents/_types/learner/preferences";
import type { UIMessageStreamWriter } from "ai";
import { Schema } from "effect";

/** Canonical learner interest and signed program context available to agents. */
export const AgentLearningSelectionSchema = Schema.Struct({
  interest: LearningInterestSchema,
  program: Schema.Struct({
    coverageStatus: ProgramCoverageSchema,
    key: LearningProgramKeySchema,
    kind: LearningProgramKindSchema,
    title: Schema.String,
    versionLabel: Schema.String,
  }).pipe(Schema.mutable),
}).pipe(Schema.mutable);

export type AgentLearningSelection = Schema.Schema.Type<
  typeof AgentLearningSelectionSchema
>;

/** Per-turn context shared by Nina and specialist agents after harness arbitration. */
export const AgentContextSchema = Schema.Struct({
  currentDate: Schema.String,
  learningSelection: Schema.optional(AgentLearningSelectionSchema),
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
