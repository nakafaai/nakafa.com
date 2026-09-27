import { FunctionImpl, GroupImpl } from "@confect/server";
import { DEFAULT_TITLE } from "@repo/ai/features/constants";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseWriter,
  MutationCtx as MutationCtxService,
} from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import { requireChatOwner } from "@repo/backend/confect/chats/access/owner";
import spec from "@repo/backend/confect/chats/mutations.spec";
import {
  insertParts,
  rewriteTranscript,
} from "@repo/backend/confect/chats/transcript/write";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import { Clock, Effect, Layer, Struct } from "effect";

/** Creates a new chat for the authenticated user. */
const createChat = FunctionImpl.make(
  databaseSchema,
  spec,
  "createChat",
  Effect.fn("chats.mutations.createChat")(function* (args) {
    const ctx = yield* MutationCtxService;
    const database = yield* DatabaseWriter;
    const user = yield* requireAuth(ctx);
    const chatId = yield* database
      .table("chats")
      .insert({
        updatedAt: yield* Clock.currentTimeMillis,
        title: args.title || DEFAULT_TITLE,
        userId: user.appUser._id,
        visibility: "private",
        type: args.type,
      })
      .pipe(Effect.orDie);
    return chatId;
  })
);
const updateChatTitle = FunctionImpl.make(
  databaseSchema,
  spec,
  "updateChatTitle",
  Effect.fn("chats.mutations.updateChatTitle")(function* (args) {
    const ctx = yield* MutationCtxService;
    const database = yield* DatabaseWriter;
    const user = yield* requireAuth(ctx);
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
    const ctx = yield* MutationCtxService;
    const database = yield* DatabaseWriter;
    const user = yield* requireAuth(ctx);
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
const saveMessage = FunctionImpl.make(
  databaseSchema,
  spec,
  "saveMessage",
  Effect.fn("chats.mutations.saveMessage")(function* (args) {
    const ctx = yield* MutationCtxService;
    const database = yield* DatabaseWriter;
    const { message, parts } = args;
    const user = yield* requireAuth(ctx);
    yield* requireChatOwner(message.chatId, user.appUser._id);
    yield* rewriteTranscript(message.chatId, message.identifier, "user");

    const messageId = yield* database
      .table("messages")
      .insert({
        chatId: message.chatId,
        role: message.role,
        identifier: message.identifier,
        ...Struct.pick(message, ["modelId"]),
        ...Struct.pick(message, ["ninaContextSnapshot"]),
        ...Struct.pick(message, ["ninaContextTransition"]),
      })
      .pipe(Effect.orDie);
    const partIds = yield* insertParts(messageId, parts);
    return {
      messageId,
      partIds,
    };
  })
);
const createChatWithMessage = FunctionImpl.make(
  databaseSchema,
  spec,
  "createChatWithMessage",
  Effect.fn("chats.mutations.createChatWithMessage")(function* (args) {
    const ctx = yield* MutationCtxService;
    const database = yield* DatabaseWriter;
    const user = yield* requireAuth(ctx);
    const chatId = yield* database
      .table("chats")
      .insert({
        updatedAt: yield* Clock.currentTimeMillis,
        title: args.title || DEFAULT_TITLE,
        userId: user.appUser._id,
        visibility: "private",
        type: args.type,
      })
      .pipe(Effect.orDie);
    const messageId = yield* database
      .table("messages")
      .insert({
        chatId,
        role: args.message.role,
        identifier: args.message.identifier,
        ...Struct.pick(args.message, ["modelId"]),
        ...Struct.pick(args.message, ["ninaContextSnapshot"]),
        ...Struct.pick(args.message, ["ninaContextTransition"]),
      })
      .pipe(Effect.orDie);
    const partIds = yield* insertParts(messageId, args.parts);
    return {
      chatId,
      messageId,
      partIds,
    };
  })
);
const deleteChat = FunctionImpl.make(
  databaseSchema,
  spec,
  "deleteChat",
  Effect.fn("chats.mutations.deleteChat")(function* (args) {
    const ctx = yield* MutationCtxService;
    const database = yield* DatabaseWriter;
    const user = yield* requireAuth(ctx);
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
  Layer.provide(createChat),
  Layer.provide(updateChatTitle),
  Layer.provide(updateChatVisibility),
  Layer.provide(saveMessage),
  Layer.provide(createChatWithMessage),
  Layer.provide(deleteChat),
  Layer.provide(atomic),
  GroupImpl.finalize
);
