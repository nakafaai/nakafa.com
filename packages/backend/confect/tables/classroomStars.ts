import { Table } from "@confect/core";
import { starValidator } from "@repo/backend/confect/classroom/library/star";

/** The items and folders each Person starred in each class library. */
export default Table.make(() => starValidator)
  .index("by_classId_and_personId", ["classId", "personId"])
  .index("by_folderId", ["folderId"])
  .index("by_itemId", ["itemId"]);
