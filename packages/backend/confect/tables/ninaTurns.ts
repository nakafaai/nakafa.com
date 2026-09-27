import { Table } from "@confect/core";
import { NinaTurn } from "@repo/backend/confect/nina/turns.spec";

export default Table.make(() => NinaTurn)
  .index("by_userId_and_requestId", ["userId", "requestId"])
  .index("by_chatId_and_order", ["chatId", "order"]);
