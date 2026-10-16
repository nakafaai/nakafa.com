import { Table } from "@confect/core";
import { tenantAssignmentValidator } from "@repo/backend/confect/tenancy/assignment";

export default Table.make(() => tenantAssignmentValidator)
  .index("by_cohortId_and_kind", ["cohortId", "kind"])
  .index("by_periodId_and_personId_and_kind", ["periodId", "personId", "kind"]);
