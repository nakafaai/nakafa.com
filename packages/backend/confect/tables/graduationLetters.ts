import { Table } from "@confect/core";
import { letterValidator } from "@repo/backend/confect/records/letter";

/** The SKL of each graduating student, read by class group and student for its list and by hash for the public check. */
export default Table.make(() => letterValidator)
  .index("by_cohortId_and_personId", ["cohortId", "personId"])
  .index("by_hash", ["hash"]);
