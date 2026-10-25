import { Table } from "@confect/core";
import { assessmentFlagValidator } from "@repo/backend/confect/assessment/flags";

/**
 * The questions flagged for review, shared by school sittings and try-outs (ADR 0031). A
 * row is written through the gate when a learner flags a question and deleted when the
 * learner unflags it, so a reload shows the same flags. The attempt's flags are read by
 * its prefix of the index.
 */
export default Table.make(() => assessmentFlagValidator).index(
  "by_attempt_and_question",
  ["attempt", "question"]
);
