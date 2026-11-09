import { Table } from "@confect/core";
import { CommentReport } from "@repo/backend/confect/comments/report";

/** One report per learner and comment, read by comment for its deletion and by learner for an account's deletion. */
export default Table.make(() => CommentReport)
  .index("by_commentId_and_userId", ["commentId", "userId"])
  .index("by_userId", ["userId"]);
