import { Table } from "@confect/core";
import { agentCodeValidator } from "@repo/backend/confect/auth/grant/schema";

export default Table.make(() => agentCodeValidator)
  .index("by_codeHash", ["codeHash"])
  .index("by_userId", ["userId"])
  .index("by_expiresAt", ["expiresAt"]);
