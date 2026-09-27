import { Table } from "@confect/core";
import { appLocaleValidator } from "@repo/backend/confect/contentRelease/spec";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    appLocale: appLocaleValidator,
    bucket: Schema.String,
    index: Schema.Finite,
    routeCount: Schema.Finite,
    snapshotId: Schema.String,
  })
)
  .index("by_snapshotId_and_index", ["snapshotId", "index"])
  .index("by_snapshotId_and_appLocale_and_bucket", [
    "snapshotId",
    "appLocale",
    "bucket",
  ]);
