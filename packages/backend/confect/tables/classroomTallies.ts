import { Table } from "@confect/core";
import { tallyValidator } from "@repo/backend/confect/classroom/forum/tally";

/** The tally of each message, found by its message, and read by place from the oldest message a reader loaded. */
export default Table.make(() => tallyValidator)
  .index("by_messageId", ["messageId"])
  .index("by_channelId_and_threadId_and_messageAt", [
    "channelId",
    "threadId",
    "messageAt",
  ]);
