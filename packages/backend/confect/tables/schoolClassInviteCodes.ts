import { Table } from "@confect/core";
import { schoolClassInviteCodeValidator } from "@repo/backend/confect/classes/schema";
export default Table.make(() => schoolClassInviteCodeValidator)
  .index("by_classId_and_role", ["classId", "role"])
  .index("by_code", ["code"])
  .index("by_schoolId", ["schoolId"]);
