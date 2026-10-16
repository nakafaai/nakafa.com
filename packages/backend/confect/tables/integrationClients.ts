import { Table } from "@confect/core";
import { integrationClientValidator } from "@repo/backend/confect/integrations/schema";

/** One integration client of a school, indexed by its school. */
export default Table.make(() => integrationClientValidator).index(
  "by_tenantId",
  ["tenantId"]
);
