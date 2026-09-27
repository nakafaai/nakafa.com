import { Table } from "@confect/core";
import {
  appLocaleValidator,
  bindingOperationValidator,
} from "@repo/backend/confect/contentRelease/spec";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    appLocale: appLocaleValidator,
    batchHash: Schema.String,
    batchIndex: Schema.Finite,
    contentKey: Schema.optionalKey(Schema.String),
    index: Schema.Finite,
    operation: bindingOperationValidator,
    publicPath: Schema.String,
    releaseId: Schema.String,
    routeJson: Schema.String,
    sequence: Schema.Finite,
  })
)
  .index("by_appLocale_and_publicPath_and_sequence_and_index", [
    "appLocale",
    "publicPath",
    "sequence",
    "index",
  ])
  .index("by_releaseId_and_index", ["releaseId", "index"])
  .index("by_releaseId_and_batchIndex", ["releaseId", "batchIndex"])
  .index("by_releaseId_and_appLocale_and_publicPath", [
    "releaseId",
    "appLocale",
    "publicPath",
  ])
  .index("by_sequence", ["sequence"]);
