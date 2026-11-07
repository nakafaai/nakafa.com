import { Table } from "@confect/core";
import { folderValidator } from "@repo/backend/confect/classroom/library/folder";

/** The folders of each class library, oldest first, found by their client key, and by their time in the trash for the daily retention sweep. */
export default Table.make(() => folderValidator)
  .index("by_classId", ["classId"])
  .index("by_classId_and_clientKey", ["classId", "clientKey"])
  .index("by_trashedAt", ["trashedAt"]);
