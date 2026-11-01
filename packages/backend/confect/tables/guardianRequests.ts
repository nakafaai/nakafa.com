import { Table } from "@confect/core";
import { guardianRequestValidator } from "@repo/backend/confect/guardians/request";

/** What parents ask the school office, read by link for the parent and by state for Staff. */
export default Table.make(() => guardianRequestValidator)
  .index("by_linkId", ["linkId"])
  .index("by_tenantId_and_state", ["tenantId", "state"]);
