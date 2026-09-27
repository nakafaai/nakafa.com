import { Table } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import {
  irtCalibrationRunStatusValidator,
  irtOperationalModelValidator,
} from "@repo/backend/confect/irt/schema";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    scaleVersionId: IdSchema("irtScaleVersions"),
    sectionIdentity: Schema.String,
    model: irtOperationalModelValidator,
    status: irtCalibrationRunStatusValidator,
    questionCount: Schema.Finite,
    responseCount: Schema.Finite,
    attemptCount: Schema.Finite,
    iterationCount: Schema.Finite,
    maxParameterDelta: Schema.Finite,
    startedAt: Schema.Finite,
    updatedAt: Schema.Finite,
    completedAt: Schema.optionalKey(Schema.Finite),
    error: Schema.optionalKey(Schema.String),
  })
).index("by_scaleVersionId_and_sectionIdentity_and_startedAt", [
  "scaleVersionId",
  "sectionIdentity",
  "startedAt",
]);
