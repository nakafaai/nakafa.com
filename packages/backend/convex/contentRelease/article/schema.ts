import {
  appLocaleValidator,
  rendererDomainValidator,
} from "@repo/backend/convex/contentRelease/spec";
import { defineTable } from "convex/server";
import { v } from "convex/values";

const tables = {
  /** Active public articles ordered independently from the search index. */
  articleCatalog: defineTable({
    appLocale: appLocaleValidator,
    assetId: v.string(),
    bucket: v.string(),
    category: v.string(),
    categoryTitle: v.string(),
    contentKey: v.string(),
    date: v.string(),
    projectionHash: v.string(),
    publicPath: v.string(),
    releaseId: v.string(),
    rendererDomain: rendererDomainValidator,
    sequence: v.number(),
  })
    .index("by_contentKey_and_appLocale", ["contentKey", "appLocale"])
    .index("by_appLocale_and_assetId", ["appLocale", "assetId"])
    .index("by_appLocale_and_contentKey", ["appLocale", "contentKey"])
    .index("by_appLocale_and_publicPath", ["appLocale", "publicPath"])
    .index("by_appLocale_and_date_and_contentKey", [
      "appLocale",
      "date",
      "contentKey",
    ])
    .index("by_appLocale_and_category_and_date_and_contentKey", [
      "appLocale",
      "category",
      "date",
      "contentKey",
    ])
    .index("by_appLocale_and_bucket_and_publicPath", [
      "appLocale",
      "bucket",
      "publicPath",
    ]),

  /** One active localized title and representative per article category. */
  articleCategories: defineTable({
    appLocale: appLocaleValidator,
    bucket: v.string(),
    category: v.string(),
    contentKey: v.string(),
    projectionHash: v.string(),
    releaseId: v.string(),
    rendererDomain: rendererDomainValidator,
    sequence: v.number(),
    title: v.string(),
  })
    .index("by_appLocale_and_category", ["appLocale", "category"])
    .index("by_appLocale_and_bucket_and_category", [
      "appLocale",
      "bucket",
      "category",
    ]),

  /** Non-empty deterministic partitions for bounded article sitemaps. */
  articleBuckets: defineTable({
    appLocale: appLocaleValidator,
    articleCount: v.number(),
    bucket: v.string(),
    categoryCount: v.number(),
  }).index("by_appLocale_and_bucket", ["appLocale", "bucket"]),
};

export default tables;
