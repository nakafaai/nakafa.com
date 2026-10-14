import { Table } from "@confect/core";
import { tenantCohortMemberValidator } from "@repo/backend/confect/tenancy/placement";
export default Table.make(() => tenantCohortMemberValidator)
  .index("by_periodId_and_personId", ["periodId", "personId"])
  .index("by_cohortId_and_personId", ["cohortId", "personId"])
  .index("by_personId", ["personId"]);
