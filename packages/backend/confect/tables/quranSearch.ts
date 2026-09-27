import { Table } from "@confect/core";
import { appLocaleValidator } from "@repo/backend/confect/contentRelease/spec";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    appLocale: appLocaleValidator,
    assetId: Schema.String,
    identity: Schema.String,
    index: Schema.Finite,
    rowHash: Schema.String,
    snapshotId: Schema.String,
    surahNumber: Schema.Finite,
    text: Schema.String,
  })
)
  .index("by_snapshotId_and_index", ["snapshotId", "index"])
  .index("by_snapshotId_and_appLocale_and_index", [
    "snapshotId",
    "appLocale",
    "index",
  ])
  .index("by_snapshotId_and_appLocale_and_assetId", [
    "snapshotId",
    "appLocale",
    "assetId",
  ])
  .index("by_snapshotId_and_identity", ["snapshotId", "identity"])
  .searchIndex("search_text", {
    searchField: "text",
    filterFields: ["snapshotId", "appLocale"],
  });
