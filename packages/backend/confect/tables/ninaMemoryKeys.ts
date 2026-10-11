import { Table } from "@confect/core";
import { NinaMemoryKey } from "@repo/backend/confect/nina/memory.spec";

export default Table.make(() => NinaMemoryKey)
  .index("by_userId_and_key", ["userId", "key"])
  .index("by_memoryId", ["memoryId"]);
