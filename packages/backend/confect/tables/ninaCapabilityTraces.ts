import { Table } from "@confect/core";
import { capabilityTraceValidator } from "@repo/backend/confect/chats/traces/spec";
export default Table.make(() => capabilityTraceValidator)
  .index("by_chatId_and_startedAt", ["chatId", "startedAt"])
  .index("by_chatId_and_responseMessageIdentifier_and_startedAt", [
    "chatId",
    "responseMessageIdentifier",
    "startedAt",
  ])
  .index("by_capability_and_startedAt", ["capability", "startedAt"])
  .index("by_status_and_startedAt", ["status", "startedAt"])
  .index("by_expiresAt", ["expiresAt"])
  .index("by_userId", ["userId"]);
