import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import { Schema } from "effect";
/** Deletes one deleted chat's messages and parts in bounded batches. */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "cleanupDeletedChat",
    args: () => ({
      chatId: IdSchema("chats"),
    }),
    returns: () => Schema.Null,
  }).middleware(Atomic)
);
