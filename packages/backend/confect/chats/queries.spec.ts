import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import chatsTable from "@repo/backend/confect/_generated/tables/chats";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { ChatAccessError } from "@repo/backend/confect/chats/access/spec";
import {
  chatTypeValidator,
  chatVisibilityValidator,
} from "@repo/backend/confect/chats/schema";
import Session from "@repo/backend/confect/middleware/session.spec";
import { Schema } from "effect";
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getChat",
      args: () => ({
        chatId: IdSchema("chats"),
      }),
      returns: () => chatsTable.Doc,
      error: () => Schema.Union([AuthFailure, ChatAccessError]),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "getChats",
      args: () => ({
        userId: IdSchema("users"),
        q: Schema.optionalKey(Schema.String),
        visibility: Schema.optionalKey(chatVisibilityValidator),
        type: Schema.optionalKey(chatTypeValidator),
      }),
      item: () => chatsTable.Doc,
    })
  )
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "getOwnChats",
      args: () => ({
        q: Schema.optionalKey(Schema.String),
        visibility: Schema.optionalKey(chatVisibilityValidator),
        type: Schema.optionalKey(chatTypeValidator),
      }),
      item: () => chatsTable.Doc,
      error: () => AuthFailure,
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getChatTitle",
      args: () => ({
        chatId: IdSchema("chats"),
      }),
      returns: () => Schema.NullOr(Schema.String),
      error: () => AuthFailure,
    }).middleware(Session)
  );
