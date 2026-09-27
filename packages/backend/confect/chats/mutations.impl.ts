import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import { requireChatOwner } from "@repo/backend/confect/chats/access/owner";
import spec from "@repo/backend/confect/chats/mutations.spec";
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
        title: args.title,
      })
      .pipe(Effect.orDie);
    return chat._id;
  })
);
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
