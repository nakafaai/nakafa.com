import { GenericId, Table } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    postId: IdSchema("schoolClassForumPosts"),
    forumId: IdSchema("schoolClassForums"),
    classId: IdSchema("schoolClasses"),
    name: Schema.String,
    fileId: GenericId.GenericId("_storage"),
    mimeType: Schema.String,
    size: Schema.Finite,
    createdBy: IdSchema("users"),
  })
)
  .index("by_postId", ["postId"])
  .index("by_fileId", ["fileId"]);
