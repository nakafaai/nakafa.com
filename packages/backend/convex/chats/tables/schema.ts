import {
  chatValidator,
  messageValidator,
  partValidator,
} from "@repo/backend/convex/chats/schema";
import { capabilityTraceValidator } from "@repo/backend/convex/chats/traces/spec";
import { defineTable } from "convex/server";

const tables = {
  chats: defineTable(chatValidator)
    .index("by_userId", ["userId"])
    .index("by_userId_and_visibility", ["userId", "visibility"])
    .index("by_userId_and_type", ["userId", "type"])
    .index("by_userId_and_visibility_and_type", [
      "userId",
      "visibility",
      "type",
    ])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["userId", "visibility", "type"],
    }),
  messages: defineTable(messageValidator)
    .index("by_chatId", ["chatId"])
    .index("by_chatId_and_identifier", ["chatId", "identifier"])
    .index("by_role", ["role"]),
  messageParts: defineTable(partValidator).index("by_messageId_and_order", [
    "messageId",
    "order",
  ]),
  ninaCapabilityTraces: defineTable(capabilityTraceValidator)
    .index("by_chatId_and_startedAt", ["chatId", "startedAt"])
    .index("by_chatId_and_responseMessageIdentifier_and_startedAt", [
      "chatId",
      "responseMessageIdentifier",
      "startedAt",
    ])
    .index("by_capability_and_startedAt", ["capability", "startedAt"])
    .index("by_status_and_startedAt", ["status", "startedAt"])
    .index("by_expiresAt", ["expiresAt"])
    .index("by_userId", ["userId"]),
};

export default tables;
