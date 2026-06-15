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

const MATERIAL_KEY_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const MATERIAL_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MATERIAL_ROUTE_PATTERN =
  /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/;

export const MaterialKeySchema = Schema.String.pipe(
  Schema.pattern(MATERIAL_KEY_PATTERN, {
    identifier: "MaterialKey",
    description: "Stable lowercase material key with dot or kebab separators.",
    message: () => "Invalid material key.",
  })
);

export type MaterialKey = SchemaType<typeof MaterialKeySchema>;

const MaterialSlugSchema = Schema.String.pipe(
  Schema.pattern(MATERIAL_SLUG_PATTERN, {
    identifier: "MaterialSlug",
    description: "Lowercase kebab-case route segment.",
    message: () => "Invalid material slug.",
  })
);

const MaterialRouteSchema = Schema.String.pipe(
  Schema.pattern(MATERIAL_ROUTE_PATTERN, {
    identifier: "MaterialRoute",
    description: "Normalized slash-separated route without a leading slash.",
    message: () => "Invalid material route.",
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

export const SubjectMaterialSectionSchema = Schema.Struct({
  slug: MaterialSlugSchema,
  translations: LocaleTitleMapSchema,
});

export type SubjectMaterialSection = SchemaType<
  typeof SubjectMaterialSectionSchema
>;

export const SubjectMaterialTopicSchema = Schema.Struct({
  sections: Schema.Array(SubjectMaterialSectionSchema),
  slug: MaterialSlugSchema,
  translations: LocaleDescriptionMapSchema,
});

export type SubjectMaterialTopic = SchemaType<
  typeof SubjectMaterialTopicSchema
>;
export type SubjectMaterialTopicInput = SchemaEncoded<
  typeof SubjectMaterialTopicSchema
>;

export const SubjectMaterialSourceSchema = Schema.Struct({
  baseRoute: MaterialRouteSchema,
  category: SubjectCategorySchema,
  grade: GradeSchema,
  kind: Schema.Literal("subject"),
  key: MaterialKeySchema,
  material: MaterialSchema,
  topics: Schema.Array(SubjectMaterialTopicSchema),
});

export type SubjectMaterialSource = SchemaType<
  typeof SubjectMaterialSourceSchema
>;
export type SubjectMaterialSourceInput = SchemaEncoded<
  typeof SubjectMaterialSourceSchema
>;

export const ExerciseMaterialSetSchema = Schema.Struct({
  slug: MaterialSlugSchema,
  translations: LocaleTitleMapSchema,
});

export type ExerciseMaterialSet = SchemaType<typeof ExerciseMaterialSetSchema>;

export const ExerciseMaterialGroupSchema = Schema.Struct({
  exerciseType: MaterialSlugSchema,
  sets: Schema.Array(ExerciseMaterialSetSchema),
  translations: LocaleDescriptionMapSchema,
  year: Schema.optional(Schema.Int.pipe(Schema.between(2000, 2100))),
});

export type ExerciseMaterialGroup = SchemaType<
  typeof ExerciseMaterialGroupSchema
>;

export const ExerciseMaterialSourceSchema = Schema.Struct({
  baseRoute: MaterialRouteSchema,
  category: ExercisesCategorySchema,
  kind: Schema.Literal("exercise"),
  key: MaterialKeySchema,
  material: ExercisesMaterialSchema,
  groups: Schema.Array(ExerciseMaterialGroupSchema),
  type: ExercisesTypeSchema,
});

export type ExerciseMaterialSource = SchemaType<
  typeof ExerciseMaterialSourceSchema
>;
export type ExerciseMaterialSourceInput = SchemaEncoded<
  typeof ExerciseMaterialSourceSchema
>;

export const MaterialSourceSchema = Schema.Union(
  SubjectMaterialSourceSchema,
  ExerciseMaterialSourceSchema
);

export type MaterialSource = SchemaType<typeof MaterialSourceSchema>;

export const MaterialLocaleSchema = LocaleSchema;
export type MaterialLocale = SchemaType<typeof MaterialLocaleSchema>;

/** Decodes one authored subject material source at module load time. */
export function defineSubjectMaterial(input: SubjectMaterialSourceInput) {
  return Schema.decodeUnknownSync(SubjectMaterialSourceSchema)(input);
}

/** Decodes one authored subject topic source chunk at module load time. */
export function defineSubjectMaterialTopic(input: SubjectMaterialTopicInput) {
  return Schema.decodeUnknownSync(SubjectMaterialTopicSchema)(input);
}

/** Decodes one authored exercise material source at module load time. */
export function defineExerciseMaterial(input: ExerciseMaterialSourceInput) {
  return Schema.decodeUnknownSync(ExerciseMaterialSourceSchema)(input);
}
