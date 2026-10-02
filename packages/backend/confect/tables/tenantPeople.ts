import { Table } from "@confect/core";
import { tenantPersonValidator } from "@repo/backend/confect/tenancy/schema";
export default Table.make(() => tenantPersonValidator)
  .index("by_tenantId_and_account_userId", ["tenantId", "account.userId"])
  .index("by_account_userId_and_kind_and_status", [
    "account.userId",
    "kind",
    "status",
  ]);
