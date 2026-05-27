import {
  localeSchema,
  nakafaSectionSchema,
} from "@repo/backend/confect/modules/content/content.schemas";
import { Schema } from "effect";

export const contentSearchRefSchema = Schema.Struct({
  content_id: Schema.String,
  locale: localeSchema,
  markdown_url: Schema.String,
  route: Schema.String,
  section: nakafaSectionSchema,
  url: Schema.String,
});

export const contentSearchSummarySchema = Schema.Struct({
  ...contentSearchRefSchema.fields,
  description: Schema.String,
  title: Schema.String,
});

export const contentSearchInputSchema = Schema.Struct({
  limit: Schema.Number,
  locale: localeSchema,
  offset: Schema.Number,
  queries: Schema.optional(Schema.Array(Schema.String)),
  section: Schema.optional(nakafaSectionSchema),
});

export const contentSearchResultSchema = Schema.Struct({
  count: Schema.Number,
  has_more: Schema.Boolean,
  items: Schema.Array(contentSearchSummarySchema),
  limit: Schema.Number,
  next_offset: Schema.Union(Schema.Number, Schema.Null),
  offset: Schema.Number,
});

export const contentSearchDocumentSchema = Schema.Struct({
  ...contentSearchSummarySchema.fields,
  contentHash: Schema.String,
  syncedAt: Schema.Number,
  text: Schema.String,
});
