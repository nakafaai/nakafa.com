import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { ChatAccessError } from "@repo/backend/confect/chats/access/spec";
import { chatVisibilityValidator } from "@repo/backend/confect/chats/schema";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { Schema } from "effect";

export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicMutation({
      name: "updateChatTitle",
      args: () => ({
        chatId: IdSchema("chats"),
        title: Schema.String,
      }),
      returns: () => IdSchema("chats"),
      error: () => Schema.Union([AuthFailure, ChatAccessError]),
    })
      .middleware(Session)
      .middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "updateChatVisibility",
      args: () => ({
        chatId: IdSchema("chats"),
        visibility: chatVisibilityValidator,
      }),
      returns: () => IdSchema("chats"),
      error: () => Schema.Union([AuthFailure, ChatAccessError]),
    })
      .middleware(Session)
      .middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "deleteChat",
      args: () => ({
        chatId: IdSchema("chats"),
      }),
      returns: () => Schema.Null,
      error: () => Schema.Union([AuthFailure, ChatAccessError]),
    })
      .middleware(Session)
      .middleware(Atomic)
  );
