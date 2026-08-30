import { modelSlotValidator } from "@repo/backend/convex/contentRelease/models/slot";
import {
  appLocaleValidator,
  rendererDomainValidator,
} from "@repo/backend/convex/contentRelease/spec";
import { defineTable } from "convex/server";
import { v } from "convex/values";

const articleFields = {
  appLocale: appLocaleValidator,
  assetId: v.string(),
  bucket: v.string(),
  category: v.string(),
  categoryTitle: v.string(),
  contentKey: v.string(),
  projectionHash: v.string(),
  publicPath: v.string(),
  releaseId: v.string(),
  rendererDomain: rendererDomainValidator,
  sequence: v.number(),
  slot: modelSlotValidator,
};

const tables = {
  /** Active public articles ordered independently from the search index. */
  articleCatalog: defineTable({
    ...articleFields,
    dateModified: v.optional(v.string()),
    datePublished: v.string(),
  })
    .index("by_slot_and_contentKey_and_appLocale", [
      "slot",
      "contentKey",
      "appLocale",
    ])
    .index("by_slot_and_appLocale_and_assetId", [
      "slot",
      "appLocale",
      "assetId",
    ])
    .index("by_slot_and_appLocale_and_contentKey", [
      "slot",
      "appLocale",
      "contentKey",
    ])
    .index("by_slot_and_appLocale_and_publicPath", [
      "slot",
      "appLocale",
      "publicPath",
    ])
    .index("by_slot_and_appLocale_and_datePublished_and_contentKey", [
      "slot",
      "appLocale",
      "datePublished",
      "contentKey",
    ])
    .index("by_slot_appLocale_category_datePublished_contentKey", [
      "slot",
      "appLocale",
      "category",
      "datePublished",
      "contentKey",
    ])
    .index("by_slot_and_appLocale_and_bucket_and_publicPath", [
      "slot",
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
    route: v.optional(v.string()),
    sequence: v.number(),
    slot: modelSlotValidator,
    title: v.string(),
  })
    .index("by_slot_and_appLocale_and_category", [
      "slot",
      "appLocale",
      "category",
    ])
    .index("by_slot_and_appLocale_and_route", ["slot", "appLocale", "route"])
    .index("by_slot_and_appLocale_and_bucket_and_category", [
      "slot",
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
    slot: modelSlotValidator,
  }).index("by_slot_and_appLocale_and_bucket", ["slot", "appLocale", "bucket"]),
};

export default tables;
