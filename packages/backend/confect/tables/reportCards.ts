import { Table } from "@confect/core";
import { reportCardValidator } from "@repo/backend/confect/records/report";

/**
 * The report cards of a cohort, read by student for the cohort's list, by hash for the public
 * check, and by student and state for the transcript, which counts the locked ones.
 */
export default Table.make(() => reportCardValidator)
  .index("by_cohortId_and_personId", ["cohortId", "personId"])
  .index("by_hash", ["hash"])
  .index("by_personId_and_state", ["personId", "state"]);
