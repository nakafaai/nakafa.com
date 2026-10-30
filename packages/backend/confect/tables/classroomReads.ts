import { Table } from "@confect/core";
import { readValidator } from "@repo/backend/confect/classroom/forum/read";

/** The read mark of each member in each channel, and in each discussion, found by the member and the place. */
export default Table.make(() => readValidator).index(
  "by_personId_and_channelId_and_threadId",
  ["personId", "channelId", "threadId"]
);
