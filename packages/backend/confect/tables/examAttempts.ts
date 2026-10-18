import { Table } from "@confect/core";
import { examAttemptValidator } from "@repo/backend/confect/exams/sittings/schema";

/**
 * One student's attempt in a proctored sitting. The attempts of a sitting are read in
 * pages for the proctor's dashboard, and the attempts still open are read in their
 * deadline order by the close, which takes one page at a time (ADR 0013).
 */
export default Table.make(() => examAttemptValidator)
  .index("by_sittingId", ["sitting"])
  .index("by_sittingId_and_personId", ["sitting", "person"])
  .index("by_sittingId_and_state_and_deadline", [
    "sitting",
    "state",
    "deadline",
  ]);
