import { Table } from "@confect/core";
import {
  irtOperationalModelValidator,
  irtScaleVersionStatusValidator,
} from "@repo/backend/confect/irt/schema";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    assessmentSnapshotId: Schema.String,
    setIdentity: Schema.String,
    model: irtOperationalModelValidator,
    status: irtScaleVersionStatusValidator,
    questionCount: Schema.Finite,
    publishedAt: Schema.Finite,
  })
)
  .index("by_setIdentity_and_publishedAt", ["setIdentity", "publishedAt"])
  .index("by_assessmentSnapshotId_and_setIdentity_and_publishedAt", [
    "assessmentSnapshotId",
    "setIdentity",
    "publishedAt",
  ]);
