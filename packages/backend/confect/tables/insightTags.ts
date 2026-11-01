import { Table } from "@confect/core";
import { insightTagValidator } from "@repo/backend/confect/insight/schema";

/** The competency each question tells of, read by exam and by question. */
export default Table.make(() => insightTagValidator)
  .index("by_examId", ["examId"])
  .index("by_questionId", ["questionId"]);
