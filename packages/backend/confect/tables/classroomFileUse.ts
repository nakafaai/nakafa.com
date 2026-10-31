import { Table } from "@confect/core";
import { fileUseValidator } from "@repo/backend/confect/classroom/forum/use";

/** How many bytes each school's forum holds, one row a school. */
export default Table.make(() => fileUseValidator).index("by_tenantId", [
  "tenantId",
]);
