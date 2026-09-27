import { Table } from "@confect/core";
import { schoolClassMaterialGroupValidator } from "@repo/backend/confect/classes/schema";
export default Table.make(() => schoolClassMaterialGroupValidator)
  .index("by_classId_and_parentId_and_order", ["classId", "parentId", "order"])
  .index("by_classId_and_parentId_and_status_and_order", [
    "classId",
    "parentId",
    "status",
    "order",
  ])
  .index("by_status_and_scheduledAt", ["status", "scheduledAt"])
  .searchIndex("search_name", {
    searchField: "name",
    filterFields: ["classId", "parentId", "status"],
  });
