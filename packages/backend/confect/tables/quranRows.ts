import { Table } from "@confect/core";
import { appLocaleValidator } from "@repo/backend/confect/contentRelease/spec";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    appLocale: Schema.optionalKey(appLocaleValidator),
    firstVerse: Schema.optionalKey(Schema.Finite),
    identity: Schema.String,
    index: Schema.Finite,
    kind: Schema.String,
    rowHash: Schema.String,
    rowJson: Schema.String,
    snapshotId: Schema.String,
    surahNumber: Schema.optionalKey(Schema.Finite),
  })
)
  .index("by_snapshotId_and_index", ["snapshotId", "index"])
  .index("by_snapshotId_and_identity", ["snapshotId", "identity"])
  .index("by_snapshotId_and_kind_and_surahNumber_and_firstVerse", [
    "snapshotId",
    "kind",
    "surahNumber",
    "firstVerse",
  ]);
