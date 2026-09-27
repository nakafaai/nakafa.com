import { GenericId, Table } from "@confect/core";
import {
  modelBuildBaseValidator,
  modelBuildPhaseValidator,
  modelBuildSlotsValidator,
} from "@repo/backend/confect/contentRelease/models/spec";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    base: modelBuildBaseValidator,
    cursor: Schema.optionalKey(Schema.String),
    generation: Schema.Finite,
    itemIndex: Schema.Finite,
    key: Schema.Literal("primary"),
    manifestHash: Schema.String,
    phase: modelBuildPhaseValidator,
    releaseId: Schema.String,
    sequence: Schema.Finite,
    slots: modelBuildSlotsValidator,
    syncJobId: Schema.optionalKey(GenericId.GenericId("_scheduled_functions")),
    updatedAt: Schema.Finite,
  })
).index("by_key", ["key"]);
