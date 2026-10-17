import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import {
  ChatAccessError,
  ChatShareReadError,
} from "@repo/backend/confect/chats/access/spec";
import {
  chatTypeValidator,
  chatVisibilityValidator,
  shareTokenValidator,
} from "@repo/backend/confect/chats/schema";
import { chatViewValidator } from "@repo/backend/confect/chats/view";
import Session from "@repo/backend/confect/middleware/session.spec";
import { Schema } from "effect";
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getChat",
      args: () => ({
        chatId: IdSchema("chats"),
        shareToken: Schema.optionalKey(shareTokenValidator),
      }),
      returns: () => chatViewValidator,
      error: () => Schema.Union([AuthFailure, ChatAccessError]),
    }).middleware(Session)
  )
  // The learner's own chats, newest first. A page holds at most
  // `CHAT_LIST_PAGE_SIZE` chats, however many the caller asks for, and a search
  // counts only its first `CHAT_SEARCH_LENGTH` characters. The argument takes
  // any text, because a client built before the bound may send a longer one.
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "getOwnChats",
      args: () => ({
        q: Schema.optionalKey(Schema.String),
        visibility: Schema.optionalKey(chatVisibilityValidator),
        type: Schema.optionalKey(chatTypeValidator),
      }),
      item: () => chatViewValidator,
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
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getShareToken",
      args: () => ({
        chatId: IdSchema("chats"),
      }),
      returns: () => Schema.NullOr(shareTokenValidator),
      error: () => Schema.Union([AuthFailure, ChatShareReadError]),
    }).middleware(Session)
  );
