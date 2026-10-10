import { Table } from "@confect/core";
import { NinaMemorySource } from "@repo/backend/confect/nina/memory.spec";

export default Table.make(() => NinaMemorySource)
  .index("by_memoryId", ["memoryId"])
  .index("by_chatId", ["chatId"]);
