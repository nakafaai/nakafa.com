import { Table } from "@confect/core";
import { examAnswerValidator } from "@repo/backend/confect/exams/sittings/schema";

/**
 * The responses that a student gives in a proctored attempt, one row for each question.
 * An answer replaces the row of its question, and the answers of an attempt are read by
 * its index, so a reload shows what the student chose (ADR 0013).
 */
export default Table.make(() => examAnswerValidator).index(
  "by_attemptId_and_questionId",
  ["attempt", "question"]
);
