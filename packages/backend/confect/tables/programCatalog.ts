import { Table } from "@confect/core";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    displayOrder: Schema.Finite,
    index: Schema.Finite,
    programKey: Schema.String,
    rowHash: Schema.String,
    rowJson: Schema.String,
    snapshotId: Schema.String,
  })
)
  .index("by_snapshotId_and_index", ["snapshotId", "index"])
  .index("by_snapshotId_and_programKey", ["snapshotId", "programKey"])
  .index("by_snapshotId_and_displayOrder_and_programKey", [
    "snapshotId",
    "displayOrder",
    "programKey",
  ]);
