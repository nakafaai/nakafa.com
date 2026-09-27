import { Table } from "@confect/core";
import { schoolClassForumPostValidator } from "@repo/backend/confect/classes/schema";
export default Table.make(() => schoolClassForumPostValidator)
  .index("by_forumId_and_sequence", ["forumId", "sequence"])
  .index("by_createdBy", ["createdBy"])
  .index("by_parentId", ["parentId"])
  .index("by_replyToUserId", ["replyToUserId"]);
