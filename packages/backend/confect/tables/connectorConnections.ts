import { Table } from "@confect/core";
import { connectionValidator } from "@repo/backend/confect/connectors/schema";

/**
 * The connections of schools and accounts. A school's Owner and Admin list the
 * school's connections by `by_tenantId_and_status`, and an account lists its own
 * by `by_userId_and_status`.
 */
export default Table.make(() => connectionValidator)
  .index("by_tenantId_and_status", ["owner.tenantId", "status"])
  .index("by_userId_and_status", ["owner.userId", "status"]);
