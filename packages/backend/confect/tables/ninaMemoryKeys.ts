import { Table } from "@confect/core";
import { NinaMemoryKey } from "@repo/backend/confect/nina/memory.spec";

export default Table.make(() => NinaMemoryKey)
  .index("by_userId_and_key_and_confirmedAt", ["userId", "key", "confirmedAt"])
  .index("by_memoryId", ["memoryId"]);
