import { Table } from "@confect/core";
import { channelValidator } from "@repo/backend/confect/classroom/forum/channel";

/** The channels of each class, read in position order, the general channel first. */
export default Table.make(() => channelValidator).index(
  "by_classId_and_position",
  ["classId", "position"]
);
