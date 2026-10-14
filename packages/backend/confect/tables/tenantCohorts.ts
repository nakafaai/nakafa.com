import { Table } from "@confect/core";
import { tenantCohortValidator } from "@repo/backend/confect/tenancy/cohort";
export default Table.make(() => tenantCohortValidator)
  .index("by_periodId_and_nameKey", ["periodId", "nameKey"])
  .index("by_periodId_and_grade_and_nameKey", ["periodId", "grade", "nameKey"]);
