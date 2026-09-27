import { Table } from "@confect/core";
import { partValidator } from "@repo/backend/confect/chats/schema";
export default Table.make(() => partValidator).index("by_messageId_and_order", [
  "messageId",
  "order",
]);
