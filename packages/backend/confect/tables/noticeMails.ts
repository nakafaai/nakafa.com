import { Table } from "@confect/core";
import { noticeMailValidator } from "@repo/backend/confect/notifications/mail";

/** The mail of each notice waiting for its time and the day's limit, read by rank, and all of one recipient's at once. */
export default Table.make(() => noticeMailValidator)
  .index("by_rank_and_dueAt", ["rank", "dueAt"])
  .index("by_recipientPersonId_and_dueAt", ["recipientPersonId", "dueAt"]);
