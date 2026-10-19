import { Table } from "@confect/core";
import { examValidator } from "@repo/backend/confect/exams/exam";

/**
 * The school exams, read by school for the list in newest first order, and by the author
 * for the school home's drafts, newest created first. A draft is read by its ID otherwise.
 */
export default Table.make(() => examValidator)
  .index("by_tenantId", ["tenantId"])
  .index("by_tenantId_and_createdBy", ["tenantId", "createdBy"]);
