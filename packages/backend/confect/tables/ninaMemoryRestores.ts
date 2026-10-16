import { Table } from "@confect/core";
import { NinaMemoryRestore } from "@repo/backend/confect/nina/memory/restore/schema";

export default Table.make(() => NinaMemoryRestore)
  .index("by_userId_and_memoryId", ["userId", "memoryId"])
  .index("by_userId_and_confirmedAt", ["userId", "confirmedAt"]);
