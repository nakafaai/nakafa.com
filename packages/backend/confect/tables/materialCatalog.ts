import { Table } from "@confect/core";
import { materialFields } from "@repo/backend/confect/contentRelease/material/schema";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    ...materialFields,
    dateModified: Schema.optionalKey(Schema.String),
    datePublished: Schema.String,
  })
)
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
  .index("by_slot_and_appLocale_and_assetId", ["slot", "appLocale", "assetId"])
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
  ]);
