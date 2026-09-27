import { Table } from "@confect/core";
import { schoolClassMemberValidator } from "@repo/backend/confect/classes/schema";
export default Table.make(() => schoolClassMemberValidator)
  .index("by_classId_and_userId", ["classId", "userId"])
  .index("by_schoolId", ["schoolId"])
  .index("by_userId", ["userId"]);
