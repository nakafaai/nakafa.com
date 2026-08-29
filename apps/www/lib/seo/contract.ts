import { ProgramNavigationLevelSchema } from "@nakafa/aksara-contracts/program/spec";
import { PublishedQuranSurahSchema } from "@repo/backend/content/quran/contract";
import { GradeSchema, MaterialSchema } from "@repo/contents/_types/taxonomy";
import { Schema } from "effect";

/** Optional authored copy used by the SEO projection. */
export const ContentSEODataSchema = Schema.Struct({
  description: Schema.optional(Schema.String),
  subject: Schema.optional(Schema.String),
  title: Schema.optional(Schema.String),
});
export type ContentSEOData = typeof ContentSEODataSchema.Type;

/** Complete SEO projection input for each supported content surface. */
export const SEOContextSchema = Schema.Union([
  Schema.Struct({
    type: Schema.Literal("material-lesson"),
    chapter: Schema.optional(Schema.String),
    data: ContentSEODataSchema,
    grade: GradeSchema,
    material: MaterialSchema,
  }),
  Schema.Struct({
    type: Schema.Literal("curriculum-context"),
    data: ContentSEODataSchema,
    level: ProgramNavigationLevelSchema,
    parent: Schema.optional(Schema.String),
    program: Schema.optional(Schema.String),
  }),
  Schema.Struct({
    type: Schema.Literal("article"),
    categoryLabel: Schema.String,
    data: ContentSEODataSchema,
  }),
  Schema.Struct({
    type: Schema.Literal("quran"),
    surah: PublishedQuranSurahSchema,
  }),
]);
export type SEOContext = typeof SEOContextSchema.Type;

/** Complete generated SEO metadata projection. */
export const SEOMetadataSchema = Schema.Struct({
  description: Schema.String,
  keywords: Schema.Array(Schema.String).pipe(Schema.mutable),
  title: Schema.String,
});
export type SEOMetadata = typeof SEOMetadataSchema.Type;
