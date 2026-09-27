import { Table } from "@confect/core";
import {
  irtOperationalModelValidator,
  irtScaleVersionStatusValidator,
} from "@repo/backend/confect/irt/schema";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    history: Schema.optionalKey(Schema.Literal(true)),
    tryoutSnapshotId: Schema.String,
    setIdentity: Schema.String,
    model: irtOperationalModelValidator,
    status: irtScaleVersionStatusValidator,
    questionCount: Schema.Finite,
    publishedAt: Schema.Finite,
  })
)
  .index("by_setIdentity_and_history_and_publishedAt", [
    "setIdentity",
    "history",
    "publishedAt",
  ])
  .index("by_tryoutSnapshotId_and_setIdentity_and_history_and_publishedAt", [
    "tryoutSnapshotId",
    "setIdentity",
    "history",
    "publishedAt",
  ]);
