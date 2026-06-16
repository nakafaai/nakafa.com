import { type DateOnly, DateOnlySchema } from "@repo/contents/_shared/date";
import { LocaleSchema } from "@repo/contents/_types/content";
import { CurriculumLensScopeSchema } from "@repo/contents/_types/graph/schema";
import { Schema } from "effect";

type SchemaType<T extends Schema.Schema.Any> = Schema.Schema.Type<T>;

const LEARNING_PROGRAM_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COVERAGE_CONCEPT_ID_PATTERN =
  /^concept:[a-z0-9]+(?::[a-z0-9]+(?:-[a-z0-9]+)*)+$/;

/**
 * Machine-readable date-only value for source-controlled program registry data.
 *
 * This aliases the repository-wide date-only contract so program/source
 * registry dates and MDX content metadata share one canonical machine format.
 */
export const ProgramDateOnlySchema = DateOnlySchema;

export type ProgramDateOnly = DateOnly;

/**
 * Canonical language-neutral learning program key.
 *
 * Program keys identify curricula, assessments, Nakafa paths, and future
 * institution/custom programs. Display language belongs in translations and
 * content coverage, not in the key.
 */
export const LearningProgramKeySchema = Schema.String.pipe(
  Schema.pattern(LEARNING_PROGRAM_KEY_PATTERN, {
    identifier: "LearningProgramKey",
    description: "Lowercase kebab-case canonical learning program key.",
    message: () =>
      "Invalid learning program key. Expected lowercase kebab-case.",
  }),
  Schema.brand("@Nakafa/LearningProgramKey")
);

export type LearningProgramKey = SchemaType<typeof LearningProgramKeySchema>;

export const LEARNING_PROGRAM_KIND_VALUES = [
  "school-curriculum",
  "assessment",
  "admission-exam",
  "custom-program",
  "institution-program",
] as const;

export const LearningProgramKindSchema = Schema.Literal(
  ...LEARNING_PROGRAM_KIND_VALUES
);

export type LearningProgramKind = SchemaType<typeof LearningProgramKindSchema>;

export const PROGRAM_NAVIGATION_MODEL_VALUES = [
  "class-curriculum-topic",
  "course-unit-lesson",
  "exam-domain-practice-set",
  "track-topic",
] as const;

export const ProgramNavigationModelSchema = Schema.Literal(
  ...PROGRAM_NAVIGATION_MODEL_VALUES
);

export type ProgramNavigationModel = SchemaType<
  typeof ProgramNavigationModelSchema
>;

export const PROGRAM_NAVIGATION_LEVEL_VALUES = [
  "class",
  "course",
  "domain",
  "lesson",
  "phase",
  "practice-set",
  "section",
  "subject",
  "topic",
  "track",
  "unit",
] as const;

export const ProgramNavigationLevelSchema = Schema.Literal(
  ...PROGRAM_NAVIGATION_LEVEL_VALUES
);

export type ProgramNavigationLevel = SchemaType<
  typeof ProgramNavigationLevelSchema
>;

/**
 * Source-registry hierarchy contract for rendering a program without assuming
 * one country's curriculum structure. This names the navigation model only;
 * coverage rows are still derived from graph routes during sync.
 */
export const ProgramNavigationSchema = Schema.Struct({
  levels: Schema.Array(ProgramNavigationLevelSchema),
  model: ProgramNavigationModelSchema,
});

export type ProgramNavigation = SchemaType<typeof ProgramNavigationSchema>;

export const LEARNING_INTEREST_VALUES = [
  "school-curriculum",
  "exam-prep",
  "assessment-prep",
] as const;

export const LearningInterestSchema = Schema.Literal(
  ...LEARNING_INTEREST_VALUES
);

export type LearningInterest = SchemaType<typeof LearningInterestSchema>;

export const LEARNING_INTEREST_PROGRAM_KIND_MATCHES = {
  "assessment-prep": ["assessment", "admission-exam"],
  "exam-prep": ["admission-exam"],
  "school-curriculum": ["school-curriculum"],
} as const satisfies Record<LearningInterest, readonly LearningProgramKind[]>;

export const LEARNING_STAGE_VALUES = [
  "grade-10",
  "grade-11",
  "grade-12",
] as const;

export const LearningStageSchema = Schema.Literal(...LEARNING_STAGE_VALUES);

export type LearningStage = SchemaType<typeof LearningStageSchema>;

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
  "curriculum-lesson",
  "curriculum-topic"
);

const LearningProgramCoverageRouteSchemaFields = {
  assetId: Schema.String,
  conceptId: Schema.String.pipe(
    Schema.pattern(COVERAGE_CONCEPT_ID_PATTERN, {
      identifier: "LearningProgramCoverageConceptId",
      description: "Graph concept ID attached to one generated route row.",
      message: () => "Invalid coverage concept ID. Expected graph concept ID.",
    })
  ),
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
  startsAt: Schema.optional(ProgramDateOnlySchema),
  endsAt: Schema.optional(ProgramDateOnlySchema),
});

export const ProgramSourceSchema = Schema.Struct({
  label: Schema.String,
  retrievedAt: ProgramDateOnlySchema,
  reviewAfter: Schema.optional(ProgramDateOnlySchema),
  type: Schema.Literal(...PROGRAM_SOURCE_TYPE_VALUES),
  url: Schema.String,
});

/** Localized learner-facing labels for one canonical learning program. */
export const ProgramTranslationSchema = Schema.Struct({
  description: Schema.String,
  title: Schema.String,
});

/** Display copy keyed by supported content/app locale. */
export const ProgramTranslationsSchema = Schema.Struct({
  en: ProgramTranslationSchema,
  id: ProgramTranslationSchema,
});

export const LearningProgramSchema = Schema.Struct({
  defaultCoverageStatus: CoverageStatusSchema,
  displayOrder: Schema.Number,
  kind: LearningProgramKindSchema,
  key: LearningProgramKeySchema,
  provider: ProgramProviderSchema,
  navigation: ProgramNavigationSchema,
  recommendedCountry: Schema.optional(Schema.String),
  sources: Schema.Array(ProgramSourceSchema),
  translations: ProgramTranslationsSchema,
  version: ProgramVersionSchema,
});

export type LearningProgram = SchemaType<typeof LearningProgramSchema>;

export const LearningProgramCoverageInputSchema = Schema.Struct({
  contentCount: Schema.Number,
  coverageStatus: CoverageStatusSchema,
  lensId: LearningProgramCoverageRouteSchemaFields.lensId,
  lensScope: CurriculumLensScopeSchema,
  locale: LearningProgramCoverageRouteSchemaFields.locale,
  programKey: LearningProgramKeySchema,
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
  programKey: LearningProgramKeySchema,
});

/** Coverage alignment derived from the runtime schema. */
export type LearningProgramCoverageAlignment = SchemaType<
  typeof LearningProgramCoverageAlignmentSchema
>;
