import { GenericId } from "@confect/core";
import { Table } from "@confect/server";
import {
  articleCategorySchema,
  localeSchema,
} from "@repo/backend/confect/modules/content/content.schemas";
import { Schema } from "effect";

/** articleContents table definition. */
export const ArticleContents = Table.make(
  "articleContents",
  Schema.Struct({
    locale: localeSchema,
    slug: Schema.String,
    category: articleCategorySchema,
    articleSlug: Schema.String,
    title: Schema.String,
    description: Schema.optional(Schema.String),
    date: Schema.Number,
    body: Schema.String,
    contentHash: Schema.String,
    syncedAt: Schema.Number,
  })
).index("by_locale_and_slug", ["locale", "slug"]);

/** articleReferences table definition. */
export const ArticleReferences = Table.make(
  "articleReferences",
  Schema.Struct({
    articleId: GenericId.GenericId("articleContents"),
    title: Schema.String,
    authors: Schema.String,
    year: Schema.Number,
    url: Schema.optional(Schema.String),
    citation: Schema.optional(Schema.String),
    publication: Schema.optional(Schema.String),
    details: Schema.optional(Schema.String),
    order: Schema.Number,
  })
).index("by_articleId", ["articleId"]);

export const tables = [ArticleContents, ArticleReferences] as const;
