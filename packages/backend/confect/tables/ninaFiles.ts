import { Table } from "@confect/core";
import { NinaFile } from "@repo/backend/confect/nina/uploads.spec";

export default Table.make(() => NinaFile)
  .index("by_chatId", ["chatId"])
  .index("by_messageId", ["messageId"]);
