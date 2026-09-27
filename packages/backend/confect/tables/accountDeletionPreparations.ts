import { Table } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    attemptId: Schema.optionalKey(Schema.String),
    authId: Schema.String,
    cancellationStartedAt: Schema.optionalKey(Schema.Finite),
    deletionStartedAt: Schema.optionalKey(Schema.Finite),
    finalizedAt: Schema.optionalKey(Schema.Finite),
    pendingSchoolId: Schema.optionalKey(IdSchema("schools")),
    pendingSchoolNextCursor: Schema.optionalKey(Schema.String),
    readyAt: Schema.optionalKey(Schema.Finite),
    recoveryAt: Schema.optionalKey(Schema.Finite),
    recoveryGeneration: Schema.Finite,
    schoolCursor: Schema.optionalKey(Schema.String),
    successorCursor: Schema.optionalKey(Schema.String),
    userId: IdSchema("users"),
  })
)
  .index("by_attemptId", ["attemptId"])
  .index("by_authId", ["authId"])
  .index("by_recoveryAt", ["recoveryAt"])
  .index("by_userId", ["userId"]);
