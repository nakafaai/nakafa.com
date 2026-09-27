import { Table } from "@confect/core";
import { chatTurnValidator } from "@repo/backend/confect/chats/turns/spec";
export default Table.make(() => chatTurnValidator).index("by_userId", [
  "userId",
]);
