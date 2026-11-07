import { Table } from "@confect/core";
import { libraryValidator } from "@repo/backend/confect/classroom/library/item";

/**
 * The items of each class library, newest first: by the folder they sit in outside the trash, by their time in
 * the trash for each class and for the daily retention sweep, found by their client key, and read by school to
 * build their index.
 */
export default Table.make(() => libraryValidator)
  .index("by_classId", ["classId"])
  .index("by_classId_and_clientKey", ["classId", "clientKey"])
  .index("by_classId_and_folderId_and_trashedAt", [
    "classId",
    "folderId",
    "trashedAt",
  ])
  .index("by_classId_and_trashedAt", ["classId", "trashedAt"])
  .index("by_tenantId", ["tenantId"])
  .index("by_trashedAt", ["trashedAt"]);
