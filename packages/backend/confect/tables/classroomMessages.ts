import { Table } from "@confect/core";
import { messageValidator } from "@repo/backend/confect/classroom/forum/message";

/**
 * The messages of each channel, read newest first by channel without the replies
 * of its discussions, the replies of each discussion read newest first, and every
 * message found by its client key, so a repeated send writes once.
 */
export default Table.make(() => messageValidator)
  .index("by_channelId_and_threadId", ["channelId", "threadId"])
  .index("by_channelId_and_clientKey", ["channelId", "clientKey"])
  .index("by_threadId", ["threadId"]);
