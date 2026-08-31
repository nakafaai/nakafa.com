import { LearningProgramKeySchema } from "@nakafa/aksara-contracts/program/spec";
import type { NakafaRuntime } from "@repo/ai/agents/nakafa/service";
import { ModelIdSchema } from "@repo/ai/config/model";
import { SourceReferenceSchema } from "@repo/ai/lib/source";
import { NinaContextPackSchema } from "@repo/ai/nina/memory/pack";
import type { MyUIMessage } from "@repo/ai/types/message";
import { PromptUserRoleSchema } from "@repo/ai/types/roles";
import { LocaleSchema } from "@repo/contents/_types/content";
import type { UIMessageStreamWriter } from "ai";
import { Schema, Struct } from "effect";
/** Canonical curriculum preference available to agents. */
export const AgentCurriculumPreferenceSchema = Schema.Struct({
  program: Schema.Struct({
    key: LearningProgramKeySchema,
    title: Schema.String,
  }).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey))),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
export type AgentCurriculumPreference = Schema.Schema.Type<
  typeof AgentCurriculumPreferenceSchema
>;
/** Per-turn context shared by Nina and specialist agents after harness arbitration. */
export const AgentContextSchema = Schema.Struct({
  currentDate: Schema.String,
  curriculumPreference: Schema.optional(AgentCurriculumPreferenceSchema),
  needsPageFetch: Schema.Boolean,
  nina: Schema.optional(NinaContextPackSchema),
  slug: Schema.String,
  url: Schema.String,
  userRole: Schema.optional(PromptUserRoleSchema),
  verified: Schema.Boolean,
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
export type AgentContext = Schema.Schema.Type<typeof AgentContextSchema>;
/** Schema-derived data passed to task-oriented specialist agents. */
export const TaskAgentDataSchema = Schema.Struct({
  context: AgentContextSchema,
  locale: LocaleSchema,
  modelId: ModelIdSchema,
  task: Schema.String,
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
type TaskAgentData = Schema.Schema.Type<typeof TaskAgentDataSchema>;
type SpecialistWriter = UIMessageStreamWriter<MyUIMessage>;
/** Parameters for the deterministic math specialist Adapter. */
export type MathAgentParams = TaskAgentData & {
  readonly writer: SpecialistWriter;
};
/** Parameters for the Nakafa content retrieval specialist Adapter. */
export type NakafaAgentParams = TaskAgentData & {
  readonly nakafa: NakafaRuntime;
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
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
/** Parameters for the external research specialist Adapter. */
export type ResearchAgentParams = Schema.Schema.Type<
  typeof ResearchAgentDataSchema
> & {
  readonly writer: SpecialistWriter;
};
