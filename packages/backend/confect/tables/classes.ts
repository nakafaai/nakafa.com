import { Table } from "@confect/core";
import { classValidator } from "@repo/backend/confect/classroom/class";
export default Table.make(() => classValidator)
  .index("by_cohortId_and_status_and_nameKey", [
    "cohortId",
    "status",
    "nameKey",
  ])
  .index("by_periodId_and_nameKey", ["periodId", "nameKey"])
  .index("by_periodId_and_slug", ["periodId", "slug"]);
