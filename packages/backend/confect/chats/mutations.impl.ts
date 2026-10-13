import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import { requireChatOwner } from "@repo/backend/confect/chats/access/owner";
import spec from "@repo/backend/confect/chats/mutations.spec";
import { startSharing, stopSharing } from "@repo/backend/confect/chats/share";
import { sealTitle } from "@repo/backend/confect/chats/title";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { Effect, Layer } from "effect";

const updateChatTitle = FunctionImpl.make(
  databaseSchema,
  spec,
  "updateChatTitle",
  Effect.fn("chats.mutations.updateChatTitle")(function* (args) {
    const database = yield* DatabaseWriter;
    const user = yield* requireAuth();
    const chat = yield* requireChatOwner(
      args.chatId,
      user.appUser._id,
      "You do not have permission to update the chat title."
    );
    yield* database
      .table("chats")
      .patch(chat._id, {
        title: yield* sealTitle(chat.userId, args.title),
      })
      .pipe(Effect.orDie);
    return chat._id;
  })
);
/**
 * Shares or unshares a chat. Sharing draws a token for the chat's link and
 * keeps the one it has when it is shared already. Unsharing deletes the token,
 * so every link to the chat stops at once, and sharing again draws a new one.
 */
const updateChatVisibility = FunctionImpl.make(
  databaseSchema,
  spec,
  "updateChatVisibility",
  Effect.fn("chats.mutations.updateChatVisibility")(function* (args) {
    const database = yield* DatabaseWriter;
    const user = yield* requireAuth();
    const chat = yield* requireChatOwner(
      args.chatId,
      user.appUser._id,
      "You do not have permission to update the chat visibility."
    );
    yield* database
      .table("chats")
      .patch(chat._id, {
        visibility: args.visibility,
      })
      .pipe(Effect.orDie);
    if (args.visibility === "public") {
      yield* startSharing(chat);
    } else {
      yield* stopSharing(chat._id);
    }
    return chat._id;
  })
);
const deleteChat = FunctionImpl.make(
  databaseSchema,
  spec,
  "deleteChat",
  Effect.fn("chats.mutations.deleteChat")(function* (args) {
    const database = yield* DatabaseWriter;
    const user = yield* requireAuth();
    yield* requireChatOwner(
      args.chatId,
      user.appUser._id,
      "You can only delete your own chats."
    );
    yield* database.table("chats").delete(args.chatId);
    return null;
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(updateChatTitle),
  Layer.provide(updateChatVisibility),
  Layer.provide(deleteChat),
  Layer.provide(atomic),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
