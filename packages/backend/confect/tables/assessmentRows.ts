import { Table } from "@confect/core";
import { ASSESSMENT_ROW_KINDS } from "@nakafa/aksara-contracts/assessment/snapshot";
import { appLocaleValidator } from "@repo/backend/confect/contentRelease/spec";
import { Schema } from "effect";

/**
 * One signed row of an assessment snapshot: its text, its hash, and the facts
 * it is read by. Catalog rows carry their locale, asset, route and order, and
 * a set and its sections the set's identity; items, readings, keys and
 * explanations carry the version hash they belong to, and an explanation its
 * language.
 */
export default Table.make(() =>
  Schema.Struct({
    appLocale: Schema.optionalKey(appLocaleValidator),
    assetId: Schema.optionalKey(Schema.String),
    identity: Schema.String,
    index: Schema.Finite,
    kind: Schema.Literals(ASSESSMENT_ROW_KINDS),
    language: Schema.optionalKey(Schema.String),
    order: Schema.optionalKey(Schema.Finite),
    publicPath: Schema.optionalKey(Schema.String),
    rowHash: Schema.String,
    rowJson: Schema.String,
    setIdentity: Schema.optionalKey(Schema.String),
    snapshotId: Schema.String,
    versionHash: Schema.optionalKey(Schema.String),
  })
)
  .index("by_snapshotId_and_index", ["snapshotId", "index"])
  .index("by_snapshotId_and_kind_and_identity", [
    "snapshotId",
    "kind",
    "identity",
  ])
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
  .index("by_snapshotId_and_setIdentity_and_appLocale_and_order", [
    "snapshotId",
    "setIdentity",
    "appLocale",
    "order",
  ])
  .index("by_kind_and_versionHash_and_language", [
    "kind",
    "versionHash",
    "language",
  ]);
