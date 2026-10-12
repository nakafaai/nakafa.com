import { Table } from "@confect/core";
import { chatShareValidator } from "@repo/backend/confect/chats/schema";
export default Table.make(() => chatShareValidator).index("by_chatId", [
  "chatId",
]);
