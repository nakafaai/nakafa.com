import { Table } from "@confect/core";
import { schoolMemberValidator } from "@repo/backend/confect/schools/schema";
/**
 * School type validator
 */
export default Table.make(() => schoolMemberValidator)
  .index("by_userId_and_status", ["userId", "status"])
  .index("by_schoolId_and_status", ["schoolId", "status"])
  .index("by_schoolId_and_userId_and_status", ["schoolId", "userId", "status"]);
