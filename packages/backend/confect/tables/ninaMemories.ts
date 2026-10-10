import { Table } from "@confect/core";
import { NinaMemory } from "@repo/backend/confect/nina/memory.spec";

export default Table.make(() => NinaMemory)
  .index("by_userId", ["userId"])
  .index("by_validUntil", ["validUntil"]);
