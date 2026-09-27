import { Table } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    forumId: IdSchema("schoolClassForums"),
    classId: IdSchema("schoolClasses"),
    userId: IdSchema("users"),
    lastReadSequence: Schema.Finite,
  })
)
  .index("by_forumId_and_userId", ["forumId", "userId"])
  .index("by_classId_and_userId", ["classId", "userId"])
  .index("by_userId", ["userId"]);
