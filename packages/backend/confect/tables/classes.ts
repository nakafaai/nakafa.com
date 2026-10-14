import { Table } from "@confect/core";
import { classValidator } from "@repo/backend/confect/classroom/class";
/** The classes, read by cohort for the name and subject checks, and by period in subject and name order. */
export default Table.make(() => classValidator)
  .index("by_cohortId_and_status_and_nameKey", [
    "cohortId",
    "status",
    "nameKey",
  ])
  .index("by_cohortId_and_status_and_subjectKey", [
    "cohortId",
    "status",
    "subjectKey",
  ])
  .index("by_periodId_and_subjectKey_and_nameKey", [
    "periodId",
    "subjectKey",
    "nameKey",
  ])
  .index("by_periodId_and_slug", ["periodId", "slug"]);
