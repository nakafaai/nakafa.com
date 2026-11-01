import { Table } from "@confect/core";
import { folderValidator } from "@repo/backend/confect/classroom/library/folder";

/** The folders of each class library, oldest first, and found by their client key. */
export default Table.make(() => folderValidator)
  .index("by_classId", ["classId"])
  .index("by_classId_and_clientKey", ["classId", "clientKey"]);
