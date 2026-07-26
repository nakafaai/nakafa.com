import {
  localeValidator,
  rendererDomainValidator,
} from "@repo/backend/convex/contentRelease/spec";
import { defineTable } from "convex/server";
import { v } from "convex/values";

const tables = {
  /** Active public articles ordered independently from the search index. */
  articleCatalog: defineTable({
    bucket: v.string(),
    category: v.string(),
    categoryTitle: v.string(),
    contentKey: v.string(),
    date: v.string(),
    locale: localeValidator,
    projectionHash: v.string(),
    publicPath: v.string(),
    releaseId: v.string(),
    rendererDomain: rendererDomainValidator,
    sequence: v.number(),
  })
    .index("by_contentKey_and_locale", ["contentKey", "locale"])
    .index("by_locale_and_date_and_contentKey", [
      "locale",
      "date",
      "contentKey",
    ])
    .index("by_locale_and_category_and_date_and_contentKey", [
      "locale",
      "category",
      "date",
      "contentKey",
    ])
    .index("by_locale_and_bucket_and_publicPath", [
      "locale",
      "bucket",
      "publicPath",
    ]),

  /** One active localized title and representative per article category. */
  articleCategories: defineTable({
    bucket: v.string(),
    category: v.string(),
    contentKey: v.string(),
    locale: localeValidator,
    projectionHash: v.string(),
    releaseId: v.string(),
    rendererDomain: rendererDomainValidator,
    sequence: v.number(),
    title: v.string(),
  })
    .index("by_locale_and_category", ["locale", "category"])
    .index("by_locale_and_bucket_and_category", [
      "locale",
      "bucket",
      "category",
    ]),

  /** Non-empty deterministic partitions for bounded article sitemaps. */
  articleBuckets: defineTable({
    articleCount: v.number(),
    bucket: v.string(),
    categoryCount: v.number(),
    locale: localeValidator,
  }).index("by_locale_and_bucket", ["locale", "bucket"]),
};

export default tables;
