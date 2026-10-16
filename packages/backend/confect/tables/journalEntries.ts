import { Table } from "@confect/core";
import { JournalEntry } from "@repo/backend/confect/journal/schema";
export default Table.make(() => JournalEntry)
  .index("by_owner_tenantId", ["owner.tenantId"])
  .index("by_owner_tenantId_and_change_type", [
    "owner.tenantId",
    "change.type",
  ]);
