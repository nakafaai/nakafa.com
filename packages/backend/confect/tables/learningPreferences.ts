import { Table } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    /**
     * The moment the learner last asked to delete every Nina memory. The
     * memories are deleted in batches after that, so every reader drops what was
     * confirmed at or before this moment in the meantime. Absent means the
     * learner never asked.
     */
    ninaMemoryClearedAt: Schema.optionalKey(Schema.Finite),
    /** Present when the learner paused Nina's memory; absent means memory is on. */
    ninaMemoryPaused: Schema.optionalKey(Schema.Literal(true)),
    preferredCurriculumProgramKey: Schema.optionalKey(Schema.String),
    preferredTryoutCountryKey: Schema.optionalKey(Schema.String),
    updatedAt: Schema.Finite,
    userId: IdSchema("users"),
  })
).index("by_userId", ["userId"]);
