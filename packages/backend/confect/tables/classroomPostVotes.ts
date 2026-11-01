import { Table } from "@confect/core";
import { postVotesValidator } from "@repo/backend/confect/classroom/posts/poll";

/** The votes of each announcement's poll, found by the announcement. */
export default Table.make(() => postVotesValidator).index("by_postId", [
  "postId",
]);
