import { Table } from "@confect/core";
import { examResultValidator } from "@repo/backend/confect/exams/results/schema";

/**
 * The scored questions of the sittings: one row for each question of each attempt, written when the
 * attempt is submitted (ADR 0031, section 4). A student's list reads its rows by sitting and person, and
 * one of them by its question too. A question's view reads them by sitting and question, in their
 * verdicts' order, so its list can keep the answers of one verdict.
 */
export default Table.make(() => examResultValidator)
  .index("by_sittingId_and_personId_and_questionId", [
    "sitting",
    "person",
    "question",
  ])
  .index("by_sittingId_and_questionId_and_verdict", [
    "sitting",
    "question",
    "verdict",
  ]);
