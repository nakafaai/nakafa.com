import { Table } from "@confect/core";
import { examValidator } from "@repo/backend/confect/exams/exam";

/**
 * The school exams, read by school for the list in newest first order. A draft is
 * read by its ID, so the one index serves the list alone.
 */
export default Table.make(() => examValidator).index("by_tenantId", [
  "tenantId",
]);
