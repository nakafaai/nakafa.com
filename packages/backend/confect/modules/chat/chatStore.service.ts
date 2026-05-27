import type { MyUIMessagePart } from "@repo/ai/types/message";
import type { Doc, Id } from "@repo/backend/confect/_generated/dataModel";
import type {
  MutationCtx as ConvexMutationCtx,
  QueryCtx as ConvexQueryCtx,
} from "@repo/backend/confect/_generated/services";
import {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/confect/_generated/services";
import {
  CHAT_TRANSCRIPT_REWRITE_MESSAGE_BATCH_SIZE,
  MAX_CHAT_MESSAGE_PARTS,
} from "@repo/backend/confect/modules/chat/constants";
import { mapUIMessagePartsToDBParts } from "@repo/backend/confect/modules/chat/messageParts/uiToDb";
import { Effect, Schema } from "effect";

export class ChatStoreError extends Schema.TaggedError<ChatStoreError>()(
  "ChatStoreError",
  { message: Schema.String }
) {}

/** Requires a chat to belong to the given user id. */
export async function readOwnedChat(
  ctx: ConvexMutationCtx | ConvexQueryCtx,
  chatId: Id<"chats">,
  userId: Id<"users">
) {
  const chat = await ctx.db.get(chatId);

  if (!chat) {
    return new ChatStoreError({ message: `Chat not found: ${chatId}` });
  }

  if (chat.userId !== userId) {
    return new ChatStoreError({
      message: "You do not have permission to modify this chat.",
    });
  }

  return chat;
}

/** Fails when a chat is unavailable to the current viewer. */
export function validateChatAccess(
  chat: Doc<"chats">,
  viewerUserId: Id<"users"> | null
) {
  if (chat.visibility === "public" || chat.userId === viewerUserId) {
    return Effect.succeed(chat);
  }

  return Effect.fail(
    new ChatStoreError({ message: "You do not have access to this chat." })
  );
}

/** Requires a chat to belong to the given user id. */
export const verifyChatOwnership = Effect.fn("chatStore.verifyChatOwnership")(
  function* (args: { chatId: Id<"chats">; userId: Id<"users"> }) {
    const ctx = yield* MutationCtx;
    const result = yield* Effect.promise(() =>
      readOwnedChat(ctx, args.chatId, args.userId)
    );

    if (result instanceof ChatStoreError) {
      return yield* Effect.fail(result);
    }

    return result;
  }
);

/** Reads one message by stable client identifier. */
export function getMessageByIdentifier(
  ctx: ConvexMutationCtx | ConvexQueryCtx,
  chatId: Id<"chats">,
  identifier: string
) {
  return ctx.db
    .query("messages")
    .withIndex("by_chatId_and_identifier", (query) =>
      query.eq("chatId", chatId).eq("identifier", identifier)
    )
    .unique();
}

/** Inserts AI SDK message parts for a persisted message. */
export const insertParts = Effect.fn("chatStore.insertParts")(function* (args: {
  messageId: Id<"messages">;
  parts: readonly MyUIMessagePart[];
}) {
  const ctx = yield* MutationCtx;

  if (args.parts.length > MAX_CHAT_MESSAGE_PARTS) {
    return yield* Effect.fail(
      new ChatStoreError({
        message: `Chat message cannot have more than ${MAX_CHAT_MESSAGE_PARTS} parts.`,
      })
    );
  }

  return yield* Effect.forEach(
    mapUIMessagePartsToDBParts({ messageParts: args.parts }),
    (part) =>
      Effect.promise(() =>
        ctx.db.insert("parts", {
          ...part,
          messageId: args.messageId,
        })
      )
  );
});

/** Deletes all parts for a message within the bounded chat rewrite batch. */
const deletePartsForMessageBatch = Effect.fn(
  "chatStore.deletePartsForMessageBatch"
)(function* (messageId: Id<"messages">) {
  const ctx = yield* MutationCtx;
  const parts = yield* Effect.promise(() =>
    ctx.db
      .query("parts")
      .withIndex("by_messageId_and_order", (query) =>
        query.eq("messageId", messageId)
      )
      .take(MAX_CHAT_MESSAGE_PARTS + 1)
  );

  for (const part of parts.slice(0, MAX_CHAT_MESSAGE_PARTS)) {
    yield* Effect.promise(() => ctx.db.delete(part._id));
  }

  return { hasMore: parts.length > MAX_CHAT_MESSAGE_PARTS };
});

/** Deletes messages and parts from a chat transcript creation-time boundary. */
export const deleteMessageBatchFromPoint = Effect.fn(
  "chatStore.deleteMessageBatchFromPoint"
)(function* (args: { chatId: Id<"chats">; fromCreationTime: number }) {
  const ctx = yield* MutationCtx;
  const messages = yield* Effect.promise(() =>
    ctx.db
      .query("messages")
      .withIndex("by_chatId", (query) =>
        query
          .eq("chatId", args.chatId)
          .gte("_creationTime", args.fromCreationTime)
      )
      .take(CHAT_TRANSCRIPT_REWRITE_MESSAGE_BATCH_SIZE)
  );

  if (messages.length === 0) {
    return { hasMore: false };
  }

  for (const message of messages) {
    const partsBatch = yield* deletePartsForMessageBatch(message._id);

    if (partsBatch.hasMore) {
      return { hasMore: true };
    }

    yield* Effect.promise(() => ctx.db.delete(message._id));
  }

  return {
    hasMore: messages.length === CHAT_TRANSCRIPT_REWRITE_MESSAGE_BATCH_SIZE,
  };
});

/** Loads one message page and attaches its ordered parts. */
export const hydrateMessagePage = Effect.fn("chatStore.hydrateMessagePage")(
  function* (messages: readonly Doc<"messages">[]) {
    const ctx = yield* QueryCtx;
    return yield* Effect.forEach(messages, (message) =>
      Effect.gen(function* () {
        const parts = yield* Effect.promise(() =>
          ctx.db
            .query("parts")
            .withIndex("by_messageId_and_order", (query) =>
              query.eq("messageId", message._id)
            )
            .order("asc")
            .take(MAX_CHAT_MESSAGE_PARTS + 1)
        );

        if (parts.length > MAX_CHAT_MESSAGE_PARTS) {
          return yield* Effect.fail(
            new ChatStoreError({
              message:
                "Chat message part count exceeds the supported load limit.",
            })
          );
        }

        return { ...message, parts };
      })
    );
  }
);
