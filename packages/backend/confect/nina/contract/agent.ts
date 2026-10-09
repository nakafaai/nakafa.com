import { LearningProgramKeySchema } from "@nakafa/aksara-contracts/program/spec";
import { Id } from "@repo/backend/confect/_generated/id";
import { ModelId } from "@repo/backend/confect/gateway/model";
import { NinaContextPackSchema } from "@repo/backend/confect/nina/contract/pack";
import { SourceReferenceSchema } from "@repo/backend/confect/nina/contract/source";
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
export type AgentCurriculumPreference =
  typeof AgentCurriculumPreferenceSchema.Type;
/** Per-turn context shared by Nina and specialist agents after authenticated admission. */
const AgentContextSchema = Schema.Struct({
  currentDate: Schema.String,
  curriculumPreference: Schema.optional(AgentCurriculumPreferenceSchema),
  nina: Schema.optional(NinaContextPackSchema),
  slug: Schema.String,
  url: Schema.String,
  userRole: Schema.optional(PromptUserRoleSchema),
  verified: Schema.Boolean,
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
export type AgentContext = typeof AgentContextSchema.Type;
/** Schema-derived data passed to task-oriented specialist agents. */
export const TaskAgentDataSchema = Schema.Struct({
  userId: Id("users"),
  context: AgentContextSchema,
  locale: LocaleSchema,
  modelId: ModelId,
  task: Schema.String,
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
export type TaskAgentData = typeof TaskAgentDataSchema.Type;
/** Schema-derived data passed to the external research specialist. */
const ResearchAgentDataSchema = Schema.Struct({
  ...TaskAgentDataSchema.fields,
  sourceReferences: Schema.Array(SourceReferenceSchema),
  toolCallId: Schema.String,
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
export type ResearchAgentData = typeof ResearchAgentDataSchema.Type;
