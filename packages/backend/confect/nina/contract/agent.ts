import { LearningProgramKeySchema } from "@nakafa/aksara-contracts/program/spec";
import { Id } from "@repo/backend/confect/_generated/id";
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
/**
 * Per-turn context shared by Nina and specialist agents after authenticated
 * admission. `memory` is whether the learner's memory is on for the turn, which
 * only Nina's own turn knows: a context without it has no memory capability.
 */
const AgentContextSchema = Schema.Struct({
  currentDate: Schema.String,
  curriculumPreference: Schema.optional(AgentCurriculumPreferenceSchema),
  memory: Schema.optional(Schema.Boolean),
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
  task: Schema.String,
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
export type TaskAgentData = typeof TaskAgentDataSchema.Type;
/**
 * Schema-derived data passed to the Nakafa content specialist. `addresses` are
 * the links to Nakafa's own site that the learner sent, which it must read.
 */
const NakafaAgentDataSchema = Schema.Struct({
  ...TaskAgentDataSchema.fields,
  addresses: Schema.Array(Schema.String),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
export type NakafaAgentData = typeof NakafaAgentDataSchema.Type;
/** Schema-derived data passed to the external research specialist. */
const ResearchAgentDataSchema = Schema.Struct({
  ...TaskAgentDataSchema.fields,
  sourceReferences: Schema.Array(SourceReferenceSchema),
  toolCallId: Schema.String,
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
export type ResearchAgentData = typeof ResearchAgentDataSchema.Type;
