import { Table } from "@confect/core";
import { snapshotFamilyValidator } from "@repo/backend/confect/contentRelease/spec";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    cleanupAt: Schema.optionalKey(Schema.Finite),
    cleanupIndex: Schema.optionalKey(Schema.Finite),
    cleanupPart: Schema.optionalKey(
      Schema.Union([
        Schema.Literal("program"),
        Schema.Literal("curriculum"),
        Schema.Literal("bucket"),
        Schema.Literal("quran"),
        Schema.Literal("quran-search"),
        Schema.Literal("runtime"),
        Schema.Literal("catalog"),
        Schema.Literal("placement"),
      ])
    ),
    cleanupRetryAt: Schema.optionalKey(Schema.Finite),
    createdAt: Schema.Finite,
    family: snapshotFamilyValidator,
    retainUntil: Schema.Finite,
    snapshotId: Schema.String,
    snapshotJson: Schema.String,
    verifiedAt: Schema.optionalKey(Schema.Finite),
  })
)
  .index("by_family_and_snapshotId", ["family", "snapshotId"])
  .index("by_retainUntil_and_family_and_snapshotId", [
    "retainUntil",
    "family",
    "snapshotId",
  ])
  .index("by_cleanupRetryAt_and_family_and_snapshotId", [
    "cleanupRetryAt",
    "family",
    "snapshotId",
  ]);
