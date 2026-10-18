import { Table } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { learnerTextValidator } from "@repo/backend/confect/writing/text";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    authorId: IdSchema("users"),
    text: learnerTextValidator,
    // Kept exact by `posts.like` and `posts.unlike`, in the same mutation as the like row.
    likeCount: Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0)),
  })
).index("by_authorId", ["authorId"]);
