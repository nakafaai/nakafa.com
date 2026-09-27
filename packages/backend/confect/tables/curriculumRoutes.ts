import { Table } from "@confect/core";
import {
  appLocaleValidator,
  curriculumLevelValidator,
} from "@repo/backend/confect/contentRelease/spec";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    appLocale: appLocaleValidator,
    bucket: Schema.optionalKey(Schema.String),
    index: Schema.Finite,
    level: curriculumLevelValidator,
    contextPath: Schema.optionalKey(Schema.String),
    materialKey: Schema.optionalKey(Schema.String),
    nodeKey: Schema.String,
    order: Schema.Finite,
    parentPath: Schema.optionalKey(Schema.String),
    programKey: Schema.String,
    path: Schema.String,
    rowHash: Schema.String,
    rowJson: Schema.String,
    snapshotId: Schema.String,
    sourcePath: Schema.String,
  })
)
  .index("by_snapshotId_and_index", ["snapshotId", "index"])
  .index("by_snapshotId_and_appLocale_and_path", [
    "snapshotId",
    "appLocale",
    "path",
  ])
  .index("by_snapshotId_and_appLocale_and_level_and_bucket_and_path", [
    "snapshotId",
    "appLocale",
    "level",
    "bucket",
    "path",
  ])
  .index("by_snapshotId_and_appLocale_and_bucket_and_path", [
    "snapshotId",
    "appLocale",
    "bucket",
    "path",
  ])
  .index("by_snapshotId_and_appLocale_and_parentPath_and_order_and_path", [
    "snapshotId",
    "appLocale",
    "parentPath",
    "order",
    "path",
  ])
  .index("by_snapshotId_and_appLocale_and_contextPath_and_order_and_path", [
    "snapshotId",
    "appLocale",
    "contextPath",
    "order",
    "path",
  ])
  .index("by_snapshotId_and_appLocale_and_programKey_and_nodeKey", [
    "snapshotId",
    "appLocale",
    "programKey",
    "nodeKey",
  ]);
