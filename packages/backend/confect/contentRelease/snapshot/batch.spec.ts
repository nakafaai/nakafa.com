import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseErrorWire } from "@repo/backend/confect/contentRelease/error";
import { snapshotBatchReceiptValidator } from "@repo/backend/confect/contentRelease/spec";
import { Schema } from "effect";

/** Stores one decoded family row in its domain-owned physical table. */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "stageSnapshotBatch",
    args: () => ({
      batchIndex: Schema.Finite,
      family: Schema.Union([
        Schema.Literal("program"),
        Schema.Literal("quran"),
        Schema.Literal("tryout"),
      ]),
      releaseId: Schema.String,
      rowJson: Schema.mutable(Schema.Array(Schema.String)),
      snapshotId: Schema.String,
    }),
    returns: () => snapshotBatchReceiptValidator,
    error: () => ReleaseErrorWire,
  })
);
