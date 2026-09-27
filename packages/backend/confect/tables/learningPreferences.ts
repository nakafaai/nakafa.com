import { Table } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    preferredCurriculumProgramKey: Schema.optionalKey(Schema.String),
    preferredTryoutCountryKey: Schema.optionalKey(Schema.String),
    updatedAt: Schema.Finite,
    userId: IdSchema("users"),
  })
).index("by_userId", ["userId"]);
