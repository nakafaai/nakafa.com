import { Table } from "@confect/core";
import { VaultKey } from "@repo/backend/confect/vault/schema";

export default Table.make(() => VaultKey)
  .index("by_userId", ["userId"])
  .index("by_root", ["root"]);
