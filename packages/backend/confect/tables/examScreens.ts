import { Table } from "@confect/core";
import { examScreenValidator } from "@repo/backend/confect/exams/sittings/schema";

/**
 * The question each attempt's screen shows now (K25): one row for each attempt, which the student's
 * device replaces as the student moves between questions, read by its attempt.
 */
export default Table.make(() => examScreenValidator).index("by_attemptId", [
  "attempt",
]);
