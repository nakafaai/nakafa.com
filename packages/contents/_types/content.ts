import { DateOnlySchema } from "@repo/contents/_shared/date";
import { locales } from "@repo/utilities/locales";
import { Schema } from "effect";
import type React from "react";

/** Locale validation schema - single source of truth */
export const LocaleSchema = Schema.Literal(...locales);
export type Locale = Schema.Schema.Type<typeof LocaleSchema>;

/** Supported top-level content roots under `packages/contents/`. */
const CONTENT_ROOTS = ["articles", "exercises", "subject"] as const;

/** Runtime validation schema for supported top-level content roots. */
const ContentRootSchema = Schema.Literal(...CONTENT_ROOTS);

/** Union of supported top-level content roots. */
export type ContentRoot = Schema.Schema.Type<typeof ContentRootSchema>;

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

const ContentSchema = Schema.Struct({
  metadata: ContentMetadataSchema,
  raw: Schema.String,
  url: Schema.String,
  locale: LocaleSchema,
  slug: Schema.String,
}).pipe(Schema.mutable);
export type Content = Schema.Schema.Type<typeof ContentSchema>;

export const ReferenceListSchema = Schema.Array(ReferenceSchema).pipe(
  Schema.mutable
);

export const CONTENT_ROOT_VALUES = {
  articles: "articles",
  exercises: "exercises",
  subject: "subject",
} as const;

export type ContentWithMDX = Omit<Content, "url" | "locale" | "slug"> & {
  default?: React.ComponentType;
};

/**
 * Content payload for page-rendering paths that only need validated metadata
 * and the compiled MDX element.
 *
 * Unlike `ContentWithMDX`, this type intentionally omits the raw MDX source so
 * render-focused callers can avoid an extra filesystem read when source text is
 * not consumed.
 */
export type RenderableContent = Omit<ContentWithMDX, "raw">;

export type ContentListWithMDX = Content & {
  default?: React.ComponentType;
};
