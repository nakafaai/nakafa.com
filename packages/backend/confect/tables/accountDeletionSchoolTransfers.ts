import { Table } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    preparationId: IdSchema("accountDeletionPreparations"),
    schoolId: IdSchema("schools"),
    successorMembershipId: IdSchema("schoolMembers"),
    successorCursor: Schema.optionalKey(Schema.String),
    successorUserId: IdSchema("users"),
  })
)
  .index("by_preparationId", ["preparationId"])
  .index("by_successorUserId", ["successorUserId"]);
