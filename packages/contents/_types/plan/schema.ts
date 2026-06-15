import { LocaleSchema } from "@repo/contents/_types/content";
import { ExercisesCategorySchema } from "@repo/contents/_types/exercises/category";
import { ExercisesMaterialSchema } from "@repo/contents/_types/exercises/material";
import { ExercisesTypeSchema } from "@repo/contents/_types/exercises/type";
import { SubjectCategorySchema } from "@repo/contents/_types/subject/category";
import { GradeSchema } from "@repo/contents/_types/subject/grade";
import { MaterialSchema } from "@repo/contents/_types/subject/material";
import { Schema } from "effect";

type SchemaType<T extends Schema.Schema.Any> = Schema.Schema.Type<T>;
type SchemaEncoded<T extends Schema.Schema.Any> = Schema.Schema.Encoded<T>;

const PLAN_KEY_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const PLAN_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PLAN_ROUTE_PATTERN =
  /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/;

const PlanKeySchema = Schema.String.pipe(
  Schema.pattern(PLAN_KEY_PATTERN, {
    identifier: "PlanKey",
    description: "Stable lowercase plan key with dot or kebab separators.",
    message: () => "Invalid plan key.",
  })
);

const PlanSlugSchema = Schema.String.pipe(
  Schema.pattern(PLAN_SLUG_PATTERN, {
    identifier: "PlanSlug",
    description: "Lowercase kebab-case route segment.",
    message: () => "Invalid plan slug.",
  })
);

const PlanRouteSchema = Schema.String.pipe(
  Schema.pattern(PLAN_ROUTE_PATTERN, {
    identifier: "PlanRoute",
    description: "Normalized slash-separated route without a leading slash.",
    message: () => "Invalid plan route.",
  })
);

const LocalizedTitleSchema = Schema.Struct({
  title: Schema.String,
});

const LocalizedDescriptionSchema = Schema.Struct({
  description: Schema.optional(Schema.String),
  title: Schema.String,
});

const LocaleTitleMapSchema = Schema.Struct({
  en: LocalizedTitleSchema,
  id: LocalizedTitleSchema,
});

const LocaleDescriptionMapSchema = Schema.Struct({
  en: LocalizedDescriptionSchema,
  id: LocalizedDescriptionSchema,
});

export const SubjectPlanSectionSchema = Schema.Struct({
  slug: PlanSlugSchema,
  translations: LocaleTitleMapSchema,
});

export type SubjectPlanSection = SchemaType<typeof SubjectPlanSectionSchema>;

export const SubjectPlanTopicSchema = Schema.Struct({
  sections: Schema.Array(SubjectPlanSectionSchema),
  slug: PlanSlugSchema,
  translations: LocaleDescriptionMapSchema,
});

export type SubjectPlanTopic = SchemaType<typeof SubjectPlanTopicSchema>;
export type SubjectPlanTopicInput = SchemaEncoded<
  typeof SubjectPlanTopicSchema
>;

export const SubjectPlanSourceSchema = Schema.Struct({
  baseRoute: PlanRouteSchema,
  category: SubjectCategorySchema,
  grade: GradeSchema,
  kind: Schema.Literal("subject"),
  key: PlanKeySchema,
  material: MaterialSchema,
  topics: Schema.Array(SubjectPlanTopicSchema),
});

export type SubjectPlanSource = SchemaType<typeof SubjectPlanSourceSchema>;
export type SubjectPlanSourceInput = SchemaEncoded<
  typeof SubjectPlanSourceSchema
>;

export const ExercisePlanSetSchema = Schema.Struct({
  slug: PlanSlugSchema,
  translations: LocaleTitleMapSchema,
});

export type ExercisePlanSet = SchemaType<typeof ExercisePlanSetSchema>;

export const ExercisePlanGroupSchema = Schema.Struct({
  exerciseType: PlanSlugSchema,
  sets: Schema.Array(ExercisePlanSetSchema),
  translations: LocaleDescriptionMapSchema,
  year: Schema.optional(Schema.Int.pipe(Schema.between(2000, 2100))),
});

export type ExercisePlanGroup = SchemaType<typeof ExercisePlanGroupSchema>;

export const ExercisePlanSourceSchema = Schema.Struct({
  baseRoute: PlanRouteSchema,
  category: ExercisesCategorySchema,
  kind: Schema.Literal("exercise"),
  key: PlanKeySchema,
  material: ExercisesMaterialSchema,
  groups: Schema.Array(ExercisePlanGroupSchema),
  type: ExercisesTypeSchema,
});

export type ExercisePlanSource = SchemaType<typeof ExercisePlanSourceSchema>;
export type ExercisePlanSourceInput = SchemaEncoded<
  typeof ExercisePlanSourceSchema
>;

export const PlanSourceSchema = Schema.Union(
  SubjectPlanSourceSchema,
  ExercisePlanSourceSchema
);

export type PlanSource = SchemaType<typeof PlanSourceSchema>;

export const PlanLocaleSchema = LocaleSchema;
export type PlanLocale = SchemaType<typeof PlanLocaleSchema>;

/** Decodes one authored subject plan source at module load time. */
export function defineSubjectPlan(input: SubjectPlanSourceInput) {
  return Schema.decodeUnknownSync(SubjectPlanSourceSchema)(input);
}

/** Decodes one authored subject topic source chunk at module load time. */
export function defineSubjectPlanTopic(input: SubjectPlanTopicInput) {
  return Schema.decodeUnknownSync(SubjectPlanTopicSchema)(input);
}

/** Decodes one authored exercise plan source at module load time. */
export function defineExercisePlan(input: ExercisePlanSourceInput) {
  return Schema.decodeUnknownSync(ExercisePlanSourceSchema)(input);
}
