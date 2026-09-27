import { Table } from "@confect/core";
import { schoolClassForumValidator } from "@repo/backend/confect/classes/schema";
export default Table.make(() => schoolClassForumValidator)
  .index("by_classId_and_lastPostAt", ["classId", "lastPostAt"])
  .index("by_classId_and_status_and_lastPostAt", [
    "classId",
    "status",
    "lastPostAt",
  ])
  .index("by_createdBy", ["createdBy"])
  .searchIndex("search_title", {
    searchField: "title",
    filterFields: ["classId", "status"],
  });
