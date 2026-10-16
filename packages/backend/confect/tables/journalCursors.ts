import { Table } from "@confect/core";
import { JournalCursor } from "@repo/backend/confect/journal/schema";
export default Table.make(() => JournalCursor)
  .index("by_consumer_and_tenantId_and_changeType", [
    "consumer",
    "tenantId",
    "changeType",
  ])
  .index("by_consumer_and_pending", ["consumer", "pending"]);
