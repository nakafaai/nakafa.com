import { Table } from "@confect/core";
import { libraryValidator } from "@repo/backend/confect/classroom/library/item";

/** The items of each class library, newest first, by the folder they sit in, found by their client key, and read by school to build their index. */
export default Table.make(() => libraryValidator)
  .index("by_classId", ["classId"])
  .index("by_classId_and_clientKey", ["classId", "clientKey"])
  .index("by_classId_and_folderId", ["classId", "folderId"])
  .index("by_tenantId", ["tenantId"]);
