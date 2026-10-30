import { Table } from "@confect/core";
import { taskValidator } from "@repo/backend/confect/classroom/tasks/task";

/** The tasks of each class, read by deadline, and found by their address or their client key. */
export default Table.make(() => taskValidator)
  .index("by_classId_and_deadline", ["classId", "deadline"])
  .index("by_classId_and_slug", ["classId", "slug"])
  .index("by_classId_and_clientKey", ["classId", "clientKey"]);
