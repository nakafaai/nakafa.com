import { Table } from "@confect/core";
import { tenantUnitValidator } from "@repo/backend/confect/tenancy/schema";
export default Table.make(() => tenantUnitValidator).index(
  "by_tenantId_and_status",
  ["tenantId", "status"]
);
