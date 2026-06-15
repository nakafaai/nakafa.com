import { LocaleSchema } from "@repo/contents/_types/content";
import { CurriculumLensScopeSchema } from "@repo/contents/_types/graph/schema";
import { Schema } from "effect";

type SchemaType<T extends Schema.Schema.Any> = Schema.Schema.Type<T>;

export const LEARNING_PROGRAM_KIND_VALUES = [
  "school-curriculum",
  "assessment",
  "admission-exam",
  "nakafa-path",
  "custom-program",
  "institution-program",
] as const;

export const LearningProgramKindSchema = Schema.Literal(
  ...LEARNING_PROGRAM_KIND_VALUES
);

export type LearningProgramKind = SchemaType<typeof LearningProgramKindSchema>;

export const LEARNING_INTEREST_VALUES = [
  "school-curriculum",
  "exam-prep",
  "assessment-prep",
  "nakafa-path",
  "custom-plan",
] as const;

export const LearningInterestSchema = Schema.Literal(
  ...LEARNING_INTEREST_VALUES
);

export type LearningInterest = SchemaType<typeof LearningInterestSchema>;

export const LEARNING_INTEREST_PROGRAM_KIND_MATCHES = {
  "assessment-prep": ["assessment", "admission-exam"],
  "custom-plan": ["custom-program", "institution-program"],
  "exam-prep": ["admission-exam"],
  "nakafa-path": ["nakafa-path"],
  "school-curriculum": ["school-curriculum"],
} as const satisfies Record<LearningInterest, readonly LearningProgramKind[]>;

export const PROGRAM_PROVIDER_KIND_VALUES = [
  "official",
  "nakafa",
  "institution",
  "learner",
] as const;

export const PROGRAM_SOURCE_TYPE_VALUES = [
  "official-policy",
  "official-blueprint",
  "official-portal",
  "nakafa-editorial",
  "institution-document",
] as const;

export const COVERAGE_STATUS_VALUES = [
  "hidden",
  "planned",
  "partial",
  "available",
  "archived",
] as const;

export const CoverageStatusSchema = Schema.Literal(...COVERAGE_STATUS_VALUES);

export type CoverageStatus = SchemaType<typeof CoverageStatusSchema>;

export const LEARNING_PLAN_ITEM_REASON_VALUES = [
  "program-alignment",
  "next-topic",
] as const;

export const LEARNING_PLAN_ITEM_STATUS_VALUES = [
  "ready",
  "done",
  "skipped",
] as const;

export const LearningPlanItemStatusSchema = Schema.Literal(
  ...LEARNING_PLAN_ITEM_STATUS_VALUES
);

export type LearningPlanItemStatus = SchemaType<
  typeof LearningPlanItemStatusSchema
>;

const CoverageRouteKindSchema = Schema.Literal(
  "exercise-group",
  "exercise-question",
  "exercise-set",
  "subject-section",
  "subject-topic"
);

const LearningProgramCoverageRouteSchemaFields = {
  assetId: Schema.String,
  kind: CoverageRouteKindSchema,
  lensId: Schema.String,
  locale: LocaleSchema,
  route: Schema.String,
};

export const LearningProgramCoverageRouteSchema = Schema.Struct(
  LearningProgramCoverageRouteSchemaFields
);

export type LearningProgramCoverageRoute = SchemaType<
  typeof LearningProgramCoverageRouteSchema
>;

export const ProgramProviderSchema = Schema.Struct({
  country: Schema.optional(Schema.String),
  kind: Schema.Literal(...PROGRAM_PROVIDER_KIND_VALUES),
  name: Schema.String,
});

export const ProgramVersionSchema = Schema.Struct({
  label: Schema.String,
  startsAt: Schema.optional(Schema.String),
  endsAt: Schema.optional(Schema.String),
});

export const ProgramSourceSchema = Schema.Struct({
  label: Schema.String,
  retrievedAt: Schema.String,
  reviewAfter: Schema.optional(Schema.String),
  type: Schema.Literal(...PROGRAM_SOURCE_TYPE_VALUES),
  url: Schema.String,
});

export const LearningProgramSchema = Schema.Struct({
  defaultCoverageStatus: CoverageStatusSchema,
  description: Schema.String,
  displayOrder: Schema.Number,
  kind: LearningProgramKindSchema,
  key: Schema.String,
  locale: LocaleSchema,
  provider: ProgramProviderSchema,
  recommendedCountry: Schema.optional(Schema.String),
  sources: Schema.Array(ProgramSourceSchema),
  title: Schema.String,
  version: ProgramVersionSchema,
});

export type LearningProgram = SchemaType<typeof LearningProgramSchema>;

export const LearningProgramCoverageInputSchema = Schema.Struct({
  contentCount: Schema.Number,
  coverageStatus: CoverageStatusSchema,
  lensId: LearningProgramCoverageRouteSchemaFields.lensId,
  lensScope: CurriculumLensScopeSchema,
  locale: LearningProgramCoverageRouteSchemaFields.locale,
  programKey: Schema.String,
  sampleContentId: LearningProgramCoverageRouteSchemaFields.assetId,
  syncedAt: Schema.Number,
});

/** Program coverage input derived from the runtime schema. */
export type LearningProgramCoverageInput = Schema.Schema.Type<
  typeof LearningProgramCoverageInputSchema
>;

export const LearningProgramCoverageAlignmentSchema = Schema.Struct({
  match: Schema.Struct({
    fallback: Schema.optional(Schema.Boolean),
    lensSegments: Schema.optional(Schema.Array(Schema.String)),
    routeKinds: Schema.optional(Schema.Array(CoverageRouteKindSchema)),
    routeSegments: Schema.optional(Schema.Array(Schema.String)),
  }),
  programKey: Schema.String,
});

/** Coverage alignment derived from the runtime schema. */
export type LearningProgramCoverageAlignment = SchemaType<
  typeof LearningProgramCoverageAlignmentSchema
>;
