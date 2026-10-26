import { Table } from "@confect/core";
import { reportCardValidator } from "@repo/backend/confect/records/report";

/** The report cards of a cohort, read by student for the cohort's list and by hash for the public check. */
export default Table.make(() => reportCardValidator)
  .index("by_cohortId_and_personId", ["cohortId", "personId"])
  .index("by_hash", ["hash"]);
