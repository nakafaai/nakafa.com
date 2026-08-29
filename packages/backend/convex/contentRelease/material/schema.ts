import {
  appLocaleValidator,
  rendererDomainValidator,
} from "@repo/backend/convex/contentRelease/spec";
import { defineTable } from "convex/server";
import { v } from "convex/values";

const materialFields = {
  appLocale: appLocaleValidator,
  assetId: v.string(),
  bucket: v.string(),
  contentKey: v.string(),
  materialKey: v.string(),
  order: v.number(),
  parentPath: v.string(),
  projectionHash: v.string(),
  projectionJson: v.string(),
  publicPath: v.string(),
  releaseId: v.string(),
  rendererDomain: rendererDomainValidator,
  sequence: v.number(),
  sourcePath: v.string(),
  topicAssetId: v.string(),
};

const tables = {
  /** Active public material lessons indexed for curriculum-card assembly. */
  materialCatalog: defineTable({
    ...materialFields,
    dateModified: v.optional(v.string()),
    datePublished: v.string(),
  })
    .index("by_contentKey_and_appLocale", ["contentKey", "appLocale"])
    .index("by_appLocale_and_contentKey", ["appLocale", "contentKey"])
    .index("by_appLocale_and_assetId", ["appLocale", "assetId"])
    .index("by_appLocale_and_topicAssetId_and_assetId", [
      "appLocale",
      "topicAssetId",
      "assetId",
    ])
    .index("by_appLocale_and_publicPath", ["appLocale", "publicPath"])
    .index("by_appLocale_and_datePublished_and_contentKey", [
      "appLocale",
      "datePublished",
      "contentKey",
    ])
    .index("by_appLocale_and_bucket_and_publicPath", [
      "appLocale",
      "bucket",
      "publicPath",
    ])
    .index("by_appLocale_and_parentPath_and_order_and_publicPath", [
      "appLocale",
      "parentPath",
      "order",
      "publicPath",
    ])
    .index("by_appLocale_and_materialKey_and_order_and_publicPath", [
      "appLocale",
      "materialKey",
      "order",
      "publicPath",
    ]),

  /** Non-empty deterministic partitions for bounded material discovery. */
  materialBuckets: defineTable({
    appLocale: appLocaleValidator,
    bucket: v.string(),
    count: v.number(),
  }).index("by_appLocale_and_bucket", ["appLocale", "bucket"]),
};

export default tables;
