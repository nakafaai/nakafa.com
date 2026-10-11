import { Table } from "@confect/core";
import { NinaMemory } from "@repo/backend/confect/nina/memory.spec";

export default Table.make(() => NinaMemory)
  .index("by_userId_and_confirmedAt", ["userId", "confirmedAt"])
  .index("by_validUntil", ["validUntil"]);
