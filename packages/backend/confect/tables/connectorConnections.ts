import { Table } from "@confect/core";
import { connectionValidator } from "@repo/backend/confect/connectors/schema";

/**
 * The connections of schools and accounts. A school's Owner and Admin list the
 * school's connections by `by_tenantId_and_status`, and an account lists its own
 * by `by_userId_and_status`. `by_googleAccountKey_and_status` counts the active
 * connections of one Google account across every owner (ADR 0015).
 * `by_status_and_nextSyncAt` finds the active connections whose sync is due.
 */
export default Table.make(() => connectionValidator)
  .index("by_tenantId_and_status", ["owner.tenantId", "status"])
  .index("by_userId_and_status", ["owner.userId", "status"])
  .index("by_googleAccountKey_and_status", ["googleAccountKey", "status"])
  .index("by_status_and_nextSyncAt", ["status", "nextSyncAt"]);
