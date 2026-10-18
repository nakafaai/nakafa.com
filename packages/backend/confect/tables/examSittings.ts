import { Table } from "@confect/core";
import { examSittingValidator } from "@repo/backend/confect/exams/sittings/schema";

/**
 * The proctored sittings of school exams. A student's sittings are read by the unit
 * that holds them, for a unit sitting, or by the cohort that holds them, for a cohort
 * sitting (ADR 0013). A sitting is read by its ID otherwise.
 */
export default Table.make(() => examSittingValidator)
  .index("by_unitId_and_cohortId_and_state", ["unitId", "cohortId", "state"])
  .index("by_cohortId_and_state", ["cohortId", "state"]);
