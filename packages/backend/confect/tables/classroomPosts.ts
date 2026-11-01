import { Table } from "@confect/core";
import { postValidator } from "@repo/backend/confect/classroom/posts/post";

/**
 * The announcements of each class, read newest first by class, the pinned ones by
 * when they were pinned, and found by their client key, so a repeated send writes once.
 */
export default Table.make(() => postValidator)
  .index("by_classId", ["classId"])
  .index("by_classId_and_clientKey", ["classId", "clientKey"])
  .index("by_classId_and_pinnedAt", ["classId", "pinnedAt"]);
