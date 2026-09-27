import { Table } from "@confect/core";
import { appLocaleValidator } from "@repo/backend/confect/contentRelease/spec";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    appLocale: appLocaleValidator,
    assetId: Schema.String,
    identity: Schema.String,
    index: Schema.Finite,
    kind: Schema.String,
    order: Schema.Finite,
    publicPath: Schema.optionalKey(Schema.String),
    rowHash: Schema.String,
    rowJson: Schema.String,
    setIdentity: Schema.optionalKey(Schema.String),
    snapshotId: Schema.String,
  })
)
  .index("by_snapshotId_and_index", ["snapshotId", "index"])
  .index("by_snapshotId_and_identity", ["snapshotId", "identity"])
  .index("by_snapshotId_and_appLocale_and_publicPath", [
    "snapshotId",
    "appLocale",
    "publicPath",
  ])
  .index("by_snapshotId_and_appLocale_and_assetId", [
    "snapshotId",
    "appLocale",
    "assetId",
  ])
  .index("by_snapshotId_and_setIdentity_and_kind_and_order", [
    "snapshotId",
    "setIdentity",
    "kind",
    "order",
  ]);
