import { Table } from "@confect/core";
import { schoolActivitySchema } from "@repo/backend/confect/schools/schema";
/**
 * School type validator
 */
export default Table.make(() => schoolActivitySchema)
  .index("by_schoolId", ["schoolId"])
  .index("by_userId", ["userId"])
  .index("by_metadata_invitedUserId", ["metadata.invitedUserId"])
  .index("by_metadata_addedUserId", ["metadata.addedUserId"])
  .index("by_metadata_removedUserId", ["metadata.removedUserId"]);
