import { Table } from "@confect/core";
import { examValidator } from "@repo/backend/confect/exams/exam";

/** The school exams, read by school for the list in newest first order. An exam is read by its ID otherwise. */
export default Table.make(() => examValidator).index("by_tenantId", [
  "tenantId",
]);
