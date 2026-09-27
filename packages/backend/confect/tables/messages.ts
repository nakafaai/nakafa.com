import { Table } from "@confect/core";
import { messageValidator } from "@repo/backend/confect/chats/schema";
export default Table.make(() => messageValidator)
  .index("by_chatId", ["chatId"])
  .index("by_chatId_and_identifier", ["chatId", "identifier"])
  .index("by_role", ["role"]);
