import { FunctionSpec, GroupSpec } from "@confect/core";
import { PaginationOptions as PaginationOptionsSchema } from "@confect/core/PaginationOptions";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import chatsTable from "@repo/backend/confect/_generated/tables/chats";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { ChatAccessFailure } from "@repo/backend/confect/chats/access/spec";
import { ninaContextSnapshotValidator } from "@repo/backend/confect/chats/context";
import {
  chatTypeValidator,
  chatVisibilityValidator,
} from "@repo/backend/confect/chats/schema";
import { TranscriptFailure } from "@repo/backend/confect/chats/transcript/spec";
import {
  paginatedChatsValidator,
  paginatedMessagesValidator,
} from "@repo/backend/confect/chats/validators";
import { Schema } from "effect";
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getChat",
      args: () => ({
        chatId: IdSchema("chats"),
      }),
      returns: () => chatsTable.Doc,
      error: () => Schema.Union([AuthFailure, ChatAccessFailure]),
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getChats",
      args: () => ({
        userId: IdSchema("users"),
        q: Schema.optionalKey(Schema.String),
        visibility: Schema.optionalKey(chatVisibilityValidator),
        type: Schema.optionalKey(chatTypeValidator),
        paginationOpts: PaginationOptionsSchema,
      }),
      returns: () => paginatedChatsValidator,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getOwnChats",
      args: () => ({
        q: Schema.optionalKey(Schema.String),
        visibility: Schema.optionalKey(chatVisibilityValidator),
        type: Schema.optionalKey(chatTypeValidator),
        paginationOpts: PaginationOptionsSchema,
      }),
      returns: () => paginatedChatsValidator,
      error: () => AuthFailure,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getChatTitle",
      args: () => ({
        chatId: IdSchema("chats"),
      }),
      returns: () => Schema.NullOr(Schema.String),
      error: () => AuthFailure,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getPinnedNinaContextForTurn",
      args: () => ({
        chatId: IdSchema("chats"),
        messageIdentifier: Schema.String,
      }),
      returns: () => Schema.NullOr(ninaContextSnapshotValidator),
      error: () => Schema.Union([AuthFailure, ChatAccessFailure]),
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "loadMessagesPage",
      args: () => ({
        chatId: IdSchema("chats"),
        paginationOpts: PaginationOptionsSchema,
      }),
      returns: () => paginatedMessagesValidator,
      error: () =>
        Schema.Union([AuthFailure, ChatAccessFailure, TranscriptFailure]),
    })
  );
