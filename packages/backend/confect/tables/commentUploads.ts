import { Table } from "@confect/core";
import { CommentUpload } from "@repo/backend/confect/comments/upload";

/** The photos learners uploaded and have not posted yet: oldest first for the daily sweep, and by learner for an account's deletion. */
export default Table.make(() => CommentUpload)
  .index("by_createdAt", ["createdAt"])
  .index("by_userId", ["userId"]);
