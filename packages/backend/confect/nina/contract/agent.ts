import { LearningProgramKeySchema } from "@nakafa/aksara-contracts/program/spec";
import { Id } from "@repo/backend/confect/_generated/id";
import type { CapabilityProgress } from "@repo/backend/confect/nina/capability/progress";
import { ModelIdSchema } from "@repo/backend/confect/nina/config/model";
import { NinaContextPackSchema } from "@repo/backend/confect/nina/memory/pack";
import { SourceReferenceSchema } from "@repo/backend/confect/nina/research/source";
import { PromptUserRoleSchema } from "@repo/backend/confect/users/role";
import { LocaleSchema } from "@repo/contents/content";
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
/** Per-turn context shared by Nina and specialist agents after authenticated admission. */
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
  userId: Id("users"),
  context: AgentContextSchema,
  locale: LocaleSchema,
  modelId: ModelIdSchema,
  task: Schema.String,
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
type TaskAgentData = Schema.Schema.Type<typeof TaskAgentDataSchema>;
/** Parameters for the deterministic math specialist Agent. */
export type MathAgentParams = TaskAgentData & {
  readonly publish: CapabilityProgress;
};
/** Parameters for the Nakafa content retrieval specialist Agent. */
export type NakafaAgentParams = TaskAgentData & {
  readonly publish: CapabilityProgress;
};
/** Schema-derived data passed to the external research specialist. */
export const ResearchAgentDataSchema = Schema.Struct({
  ...TaskAgentDataSchema.fields,
  sourceReferences: Schema.Array(SourceReferenceSchema),
  toolCallId: Schema.String,
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
/** Parameters for the external research specialist Agent. */
export type ResearchAgentParams = Schema.Schema.Type<
  typeof ResearchAgentDataSchema
> & {
  readonly publish: CapabilityProgress;
};
