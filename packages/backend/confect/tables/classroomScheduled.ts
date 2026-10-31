import { Table } from "@confect/core";
import { scheduledValidator } from "@repo/backend/confect/classroom/posts/scheduled";

/** The announcements of each class that wait for their time, the soonest first, and found by their client key. */
export default Table.make(() => scheduledValidator)
  .index("by_classId_and_publishAt", ["classId", "publishAt"])
  .index("by_classId_and_clientKey", ["classId", "clientKey"]);
