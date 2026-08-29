import { modelSlotValidator } from "@repo/backend/convex/contentRelease/models/slot";
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
  slot: modelSlotValidator,
};

const tables = {
  /** Active public material lessons indexed for curriculum-card assembly. */
  materialCatalog: defineTable({
    ...materialFields,
    dateModified: v.optional(v.string()),
    datePublished: v.string(),
  })
    .index("by_slot_and_contentKey_and_appLocale", [
      "slot",
      "contentKey",
      "appLocale",
    ])
    .index("by_slot_and_appLocale_and_contentKey", [
      "slot",
      "appLocale",
      "contentKey",
    ])
    .index("by_slot_and_appLocale_and_assetId", [
      "slot",
      "appLocale",
      "assetId",
    ])
    .index("by_slot_and_appLocale_and_topicAssetId_and_assetId", [
      "slot",
      "appLocale",
      "topicAssetId",
      "assetId",
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
    .index("by_slot_and_appLocale_and_bucket_and_publicPath", [
      "slot",
      "appLocale",
      "bucket",
      "publicPath",
    ])
    .index("by_slot_and_appLocale_and_parentPath_and_order_and_publicPath", [
      "slot",
      "appLocale",
      "parentPath",
      "order",
      "publicPath",
    ])
    .index("by_slot_and_appLocale_and_materialKey_and_order_and_publicPath", [
      "slot",
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
    slot: modelSlotValidator,
  }).index("by_slot_and_appLocale_and_bucket", ["slot", "appLocale", "bucket"]),
};

export default tables;
