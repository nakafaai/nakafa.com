import { Table } from "@confect/core";
import { messageValidator } from "@repo/backend/confect/classroom/forum/message";

/**
 * The messages of each channel, read newest first by channel, and found by their
 * client key, so a repeated send writes once.
 */
export default Table.make(() => messageValidator)
  .index("by_channelId", ["channelId"])
  .index("by_channelId_and_clientKey", ["channelId", "clientKey"]);
