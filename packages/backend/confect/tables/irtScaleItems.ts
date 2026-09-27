import { Table } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { irtCalibrationStatusValidator } from "@repo/backend/confect/irt/schema";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    scaleVersionId: IdSchema("irtScaleVersions"),
    calibrationRunId: IdSchema("irtCalibrationRuns"),
    placementIdentity: Schema.String,
    placementRowHash: Schema.String,
    difficulty: Schema.Finite,
    discrimination: Schema.Finite,
    responseCount: Schema.Finite,
    correctRate: Schema.Finite,
    calibrationStatus: irtCalibrationStatusValidator,
  })
)
  .index("by_calibrationRunId", ["calibrationRunId"])
  .index("by_calibrationStatus", ["calibrationStatus"])
  .index("by_scaleVersionId_and_placementIdentity", [
    "scaleVersionId",
    "placementIdentity",
  ]);
