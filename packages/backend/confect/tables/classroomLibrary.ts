import { Table } from "@confect/core";
import { libraryValidator } from "@repo/backend/confect/classroom/library/item";

/** The items of each class library, newest first, and found by their client key. */
export default Table.make(() => libraryValidator)
  .index("by_classId", ["classId"])
  .index("by_classId_and_clientKey", ["classId", "clientKey"]);
