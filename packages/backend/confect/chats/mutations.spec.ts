import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import messageParts from "@repo/backend/confect/_generated/tables/messageParts";
import messages from "@repo/backend/confect/_generated/tables/messages";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { ChatAccessError } from "@repo/backend/confect/chats/access/spec";
import {
  chatTypeValidator,
  chatVisibilityValidator,
} from "@repo/backend/confect/chats/schema";
import { TranscriptLimitExceeded } from "@repo/backend/confect/chats/transcript/spec";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { Schema } from "effect";

/** Creates a new chat for the authenticated user. */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicMutation({
      name: "createChat",
      args: () => ({
        title: Schema.optionalKey(Schema.String),
        type: chatTypeValidator,
      }),
      returns: () => IdSchema("chats"),
      error: () => AuthFailure,
    })
      .middleware(Session)
      .middleware(Atomic)
  )
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
      name: "saveMessage",
      args: () => ({
        message: messages.Fields,
        parts: Schema.mutable(
          Schema.Array(
            Schema.Struct({
              ...messageParts.Fields.fields,
              messageId: Schema.optionalKey(IdSchema("messages")),
            })
          )
        ),
      }),
      returns: () =>
        Schema.Struct({
          messageId: IdSchema("messages"),
          partIds: Schema.mutable(Schema.Array(IdSchema("messageParts"))),
        }),
      error: () =>
        Schema.Union([ChatAccessError, TranscriptLimitExceeded, AuthFailure]),
    })
      .middleware(Session)
      .middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "createChatWithMessage",
      args: () => ({
        title: Schema.optionalKey(Schema.String),
        type: chatTypeValidator,
        message: Schema.Struct({
          ...messages.Fields.fields,
          chatId: Schema.optionalKey(IdSchema("chats")),
        }),
        parts: Schema.mutable(
          Schema.Array(
            Schema.Struct({
              ...messageParts.Fields.fields,
              messageId: Schema.optionalKey(IdSchema("messages")),
            })
          )
        ),
      }),
      returns: () =>
        Schema.Struct({
          chatId: IdSchema("chats"),
          messageId: IdSchema("messages"),
          partIds: Schema.mutable(Schema.Array(IdSchema("messageParts"))),
        }),
      error: () => Schema.Union([AuthFailure, TranscriptLimitExceeded]),
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
