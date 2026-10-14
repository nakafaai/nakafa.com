import { Table } from "@confect/core";
import { tenantPeriodValidator } from "@repo/backend/confect/tenancy/period";
export default Table.make(() => tenantPeriodValidator)
  .index("by_unitId_and_start", ["unitId", "start"])
  .index("by_unitId_and_status", ["unitId", "status"]);
