import { Table } from "@confect/core";
import { ItemFamilyIdSchema } from "@nakafa/aksara-contracts/assessment/identity";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { irtCalibrationStatusValidator } from "@repo/backend/confect/irt/schema";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    scaleVersionId: IdSchema("irtScaleVersions"),
    calibrationRunId: IdSchema("irtCalibrationRuns"),
    /** The item family the parameters calibrate: every language version of a family shares one structure. */
    family: ItemFamilyIdSchema,
    difficulty: Schema.Finite,
    discrimination: Schema.Finite,
    responseCount: Schema.Finite,
    correctRate: Schema.Finite,
    calibrationStatus: irtCalibrationStatusValidator,
  })
)
  .index("by_calibrationRunId", ["calibrationRunId"])
  .index("by_scaleVersionId_and_family", ["scaleVersionId", "family"]);
