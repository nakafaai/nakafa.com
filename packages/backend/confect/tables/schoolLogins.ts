import { Table } from "@confect/core";
import { schoolLoginValidator } from "@repo/backend/confect/identity/schema";

export default Table.make(() => schoolLoginValidator)
  .index("by_personId", ["personId"])
  .index("by_tenantId_and_name", ["tenantId", "name"]);
