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
  slot: v.optional(modelSlotValidator),
};

const tables = {
  /** Active public articles ordered independently from the search index. */
  articleCatalog: defineTable({
    ...articleFields,
    dateModified: v.optional(v.string()),
    datePublished: v.string(),
  })
    .index("by_slot_and_contentKey_and_appLocale", {
      fields: ["slot", "contentKey", "appLocale"],
      staged: true,
    })
    .index("by_slot_and_appLocale_and_assetId", {
      fields: ["slot", "appLocale", "assetId"],
      staged: true,
    })
    .index("by_slot_and_appLocale_and_contentKey", {
      fields: ["slot", "appLocale", "contentKey"],
      staged: true,
    })
    .index("by_slot_and_appLocale_and_publicPath", {
      fields: ["slot", "appLocale", "publicPath"],
      staged: true,
    })
    .index("by_slot_and_appLocale_and_datePublished_and_contentKey", {
      fields: ["slot", "appLocale", "datePublished", "contentKey"],
      staged: true,
    })
    .index("by_slot_appLocale_category_datePublished_contentKey", {
      fields: ["slot", "appLocale", "category", "datePublished", "contentKey"],
      staged: true,
    })
    .index("by_slot_and_appLocale_and_bucket_and_publicPath", {
      fields: ["slot", "appLocale", "bucket", "publicPath"],
      staged: true,
    })
    .index("by_contentKey_and_appLocale", ["contentKey", "appLocale"])
    .index("by_appLocale_and_assetId", ["appLocale", "assetId"])
    .index("by_appLocale_and_contentKey", ["appLocale", "contentKey"])
    .index("by_appLocale_and_publicPath", ["appLocale", "publicPath"])
    .index("by_appLocale_and_datePublished_and_contentKey", [
      "appLocale",
      "datePublished",
      "contentKey",
    ])
    .index("by_appLocale_and_category_and_datePublished_and_contentKey", [
      "appLocale",
      "category",
      "datePublished",
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
    route: v.optional(v.string()),
    sequence: v.number(),
    slot: v.optional(modelSlotValidator),
    title: v.string(),
  })
    .index("by_slot_and_appLocale_and_category", {
      fields: ["slot", "appLocale", "category"],
      staged: true,
    })
    .index("by_slot_and_appLocale_and_route", {
      fields: ["slot", "appLocale", "route"],
      staged: true,
    })
    .index("by_slot_and_appLocale_and_bucket_and_category", {
      fields: ["slot", "appLocale", "bucket", "category"],
      staged: true,
    })
    .index("by_appLocale_and_category", ["appLocale", "category"])
    .index("by_appLocale_and_route", ["appLocale", "route"])
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
    slot: v.optional(modelSlotValidator),
  })
    .index("by_slot_and_appLocale_and_bucket", {
      fields: ["slot", "appLocale", "bucket"],
      staged: true,
    })
    .index("by_appLocale_and_bucket", ["appLocale", "bucket"]),
};

export default tables;
