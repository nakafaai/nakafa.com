import { Table } from "@confect/core";
import { agentGrantValidator } from "@repo/backend/confect/auth/grant/schema";

export default Table.make(() => agentGrantValidator)
  .index("by_userId", ["userId"])
  .index("by_refreshHash", ["refreshHash"])
  .index("by_clientId", ["clientId"])
  .index("by_refreshedAt", ["refreshedAt"]);
