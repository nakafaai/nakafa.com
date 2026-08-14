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

const ReferenceSchema = Schema.Struct({
  title: Schema.String,
  authors: Schema.String,
  year: Schema.Number,
  url: Schema.optional(Schema.String),
  citation: Schema.optional(Schema.String),
  publication: Schema.optional(Schema.String),
  details: Schema.optional(Schema.String),
}).pipe(Schema.mutable);
export type Reference = Schema.Schema.Type<typeof ReferenceSchema>;

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
