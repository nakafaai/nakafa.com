import { Table } from "@confect/core";
import { schoolClassValidator } from "@repo/backend/confect/classes/schema";
export default Table.make(() => schoolClassValidator)
  .index("by_schoolId_and_isArchived_and_visibility", [
    "schoolId",
    "isArchived",
    "visibility",
  ])
  .index("by_schoolId_and_visibility_and_isArchived", [
    "schoolId",
    "visibility",
    "isArchived",
  ])
  .searchIndex("search_name", {
    searchField: "name",
    filterFields: ["schoolId", "isArchived", "visibility"],
  });
