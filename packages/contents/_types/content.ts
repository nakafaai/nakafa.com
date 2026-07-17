import { DateOnlySchema } from "@repo/contents/_shared/date";
import { locales } from "@repo/utilities/locales";
import { Schema } from "effect";

/** Locale validation schema - single source of truth */
export const LocaleSchema = Schema.Literal(...locales);
export type Locale = Schema.Schema.Type<typeof LocaleSchema>;

const ArticleSchema = Schema.Struct({
  title: Schema.String,
  description: Schema.String,
  date: Schema.String,
  slug: Schema.String,
  official: Schema.Boolean,
}).pipe(Schema.mutable);
export type Article = Schema.Schema.Type<typeof ArticleSchema>;

export const ReferenceSchema = Schema.Struct({
  title: Schema.String,
  authors: Schema.String,
  year: Schema.Number,
  url: Schema.optional(Schema.String),
  citation: Schema.optional(Schema.String),
  publication: Schema.optional(Schema.String),
  details: Schema.optional(Schema.String),
}).pipe(Schema.mutable);
export type Reference = Schema.Schema.Type<typeof ReferenceSchema>;

export const ContentMetadataSchema = Schema.Struct({
  title: Schema.String,
  description: Schema.optional(Schema.String),
  authors: Schema.Array(
    Schema.Struct({
      name: Schema.String,
    }).pipe(Schema.mutable)
  ).pipe(Schema.mutable),
  date: DateOnlySchema,
  subject: Schema.optional(Schema.String),
}).pipe(Schema.mutable);
export type ContentMetadata = Schema.Schema.Type<typeof ContentMetadataSchema>;

const ContentPaginationItemSchema = Schema.Struct({
  href: Schema.String,
  title: Schema.String,
}).pipe(Schema.mutable);

const ContentPaginationSchema = Schema.Struct({
  prev: ContentPaginationItemSchema,
  next: ContentPaginationItemSchema,
}).pipe(Schema.mutable);
export type ContentPagination = Schema.Schema.Type<
  typeof ContentPaginationSchema
>;

export const CONTENT_ROOT_VALUES = {
  articles: "articles",
  material: "material",
  quran: "quran",
} as const;
