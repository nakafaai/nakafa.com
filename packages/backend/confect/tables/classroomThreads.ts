import { Table } from "@confect/core";
import { threadValidator } from "@repo/backend/confect/classroom/forum/thread";

/**
 * The numbered discussions of each class, found by their number, and the highest
 * number of a class read last first, so an open takes the next one.
 */
export default Table.make(() => threadValidator).index(
  "by_classId_and_number",
  ["classId", "number"]
);
