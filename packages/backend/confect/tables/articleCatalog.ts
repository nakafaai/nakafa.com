import { Table } from "@confect/core";
import { articleFields } from "@repo/backend/confect/contentRelease/article/schema";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    ...articleFields,
    dateModified: Schema.optionalKey(Schema.String),
    datePublished: Schema.String,
  })
)
  .index("by_slot_and_contentKey_and_appLocale", [
    "slot",
    "contentKey",
    "appLocale",
  ])
  .index("by_slot_and_appLocale_and_assetId", ["slot", "appLocale", "assetId"])
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
  ]);
