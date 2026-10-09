import { Table } from "@confect/core";
import { snapshotFamilyValidator } from "@repo/backend/confect/contentRelease/spec";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    batchHash: Schema.String,
    batchIndex: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
    createdAt: Schema.Finite,
    family: snapshotFamilyValidator,
    firstIndex: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
    releaseId: Schema.String,
    rowCount: Schema.Int.check(Schema.isGreaterThan(0)),
    sequence: Schema.Finite,
    snapshotId: Schema.String,
  })
)
  .index("by_releaseId_and_family_and_batchIndex", [
    "releaseId",
    "family",
    "batchIndex",
  ])
  .index("by_sequence_and_family_and_batchIndex", [
    "sequence",
    "family",
    "batchIndex",
  ]);
