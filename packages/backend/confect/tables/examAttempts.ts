import { Table } from "@confect/core";
import { examAttemptValidator } from "@repo/backend/confect/exams/sittings/schema";

/**
 * One student's attempt in a proctored sitting. The attempts of a sitting are read in
 * pages for the proctor's dashboard, and the attempts still open are read in their
 * deadline order by the close, which takes one page at a time (ADR 0013). A student's
 * attempts are read by person, so the student's list shows the state of each sitting
 * and keeps the results of the closed ones. The closing and submitted attempts of a student
 * are read by person and state, so the student's other attempts never hide them.
 */
export default Table.make(() => examAttemptValidator)
  .index("by_sittingId", ["sitting"])
  .index("by_sittingId_and_personId", ["sitting", "person"])
  .index("by_sittingId_and_state_and_deadline", [
    "sitting",
    "state",
    "deadline",
  ])
  .index("by_personId", ["person"])
  .index("by_personId_and_state", ["person", "state"]);
