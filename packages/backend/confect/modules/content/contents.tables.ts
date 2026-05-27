import { GenericId } from "@confect/core";
import { Table } from "@confect/server";
import {
  contentRefSchema,
  localeSchema,
} from "@repo/backend/confect/modules/content/content.schemas";
import { contentSearchDocumentSchema } from "@repo/backend/confect/modules/content/search.schemas";
import { Schema } from "effect";

/** contentViews table definition. */
export const ContentViews = Table.make(
  "contentViews",
  Schema.Struct({
    contentRef: contentRefSchema,
    locale: localeSchema,
    slug: Schema.String,
    deviceId: Schema.String,
    userId: Schema.optional(GenericId.GenericId("users")),
    firstViewedAt: Schema.Number,
    lastViewedAt: Schema.Number,
  })
)
  .index("by_userId_and_contentRefId", ["userId", "contentRef.id"])
  .index("by_userId_and_contentRefType_and_locale_and_lastViewedAt", [
    "userId",
    "contentRef.type",
    "locale",
    "lastViewedAt",
  ])
  .index("by_deviceId_and_contentRefId", ["deviceId", "contentRef.id"])
  .index("by_locale_and_contentRefType_and_lastViewedAt", [
    "locale",
    "contentRef.type",
    "lastViewedAt",
  ]);

/** contentViewAnalyticsQueue table definition. */
export const ContentViewAnalyticsQueue = Table.make(
  "contentViewAnalyticsQueue",
  Schema.Struct({
    contentRef: contentRefSchema,
    locale: localeSchema,
    partition: Schema.Number,
    viewedAt: Schema.Number,
  })
).index("by_partition", ["partition"]);

/** contentAnalyticsPartitions table definition. */
export const ContentAnalyticsPartitions = Table.make(
  "contentAnalyticsPartitions",
  Schema.Struct({
    leaseExpiresAt: Schema.Number,
    leaseVersion: Schema.Number,
    lastProcessedAt: Schema.optional(Schema.Number),
    partition: Schema.Number,
  })
).index("by_partition", ["partition"]);

/** articlePopularity table definition. */
export const ArticlePopularity = Table.make(
  "articlePopularity",
  Schema.Struct({
    contentId: GenericId.GenericId("articleContents"),
    viewCount: Schema.Number,
    updatedAt: Schema.Number,
  })
)
  .index("by_contentId", ["contentId"])
  .index("by_viewCount_and_contentId", ["viewCount", "contentId"]);

/** subjectPopularity table definition. */
export const SubjectPopularity = Table.make(
  "subjectPopularity",
  Schema.Struct({
    contentId: GenericId.GenericId("subjectSections"),
    viewCount: Schema.Number,
    updatedAt: Schema.Number,
  })
)
  .index("by_contentId", ["contentId"])
  .index("by_viewCount_and_contentId", ["viewCount", "contentId"]);

/** subjectTrendingBuckets table definition. */
export const SubjectTrendingBuckets = Table.make(
  "subjectTrendingBuckets",
  Schema.Struct({
    bucketStart: Schema.Number,
    contentId: GenericId.GenericId("subjectSections"),
    locale: localeSchema,
    updatedAt: Schema.Number,
    viewCount: Schema.Number,
  })
).index("by_locale_and_bucketStart_and_contentId", [
  "locale",
  "bucketStart",
  "contentId",
]);

/** exercisePopularity table definition. */
export const ExercisePopularity = Table.make(
  "exercisePopularity",
  Schema.Struct({
    contentId: GenericId.GenericId("exerciseSets"),
    viewCount: Schema.Number,
    updatedAt: Schema.Number,
  })
)
  .index("by_contentId", ["contentId"])
  .index("by_viewCount_and_contentId", ["viewCount", "contentId"]);

/** contentSearch table definition. */
export const ContentSearch = Table.make(
  "contentSearch",
  contentSearchDocumentSchema
)
  .index("by_content_id", ["content_id"])
  .index("by_locale_and_title", ["locale", "title"])
  .index("by_locale_and_section_and_title", ["locale", "section", "title"])
  .searchIndex("search_title", {
    searchField: "title",
    filterFields: ["locale", "section"],
  })
  .searchIndex("search_text", {
    searchField: "text",
    filterFields: ["locale", "section"],
  });

export const tables = [
  ContentViews,
  ContentViewAnalyticsQueue,
  ContentAnalyticsPartitions,
  ArticlePopularity,
  SubjectPopularity,
  SubjectTrendingBuckets,
  ExercisePopularity,
  ContentSearch,
] as const;
