import type { Doc, Id } from "@repo/backend/confect/_generated/dataModel";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import type { MessagePartInput } from "@repo/backend/confect/modules/chat/chats.tables";
import {
  CHAT_TRANSCRIPT_REWRITE_MESSAGE_BATCH_SIZE,
  MAX_CHAT_MESSAGE_PARTS,
} from "@repo/backend/confect/modules/chat/constants";
import { Effect, Schema } from "effect";

export class ChatStoreError extends Schema.TaggedError<ChatStoreError>()(
  "ChatStoreError",
  { message: Schema.String }
) {}

/** Requires a chat to belong to the given user id. */
export const readOwnedChat = Effect.fnUntraced(function* (args: {
  chatId: Id<"chats">;
  userId: Id<"users">;
}) {
  const reader = yield* DatabaseReader;
  const chat = yield* reader
    .table("chats")
    .get(args.chatId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (!chat) {
    return yield* Effect.fail(
      new ChatStoreError({ message: `Chat not found: ${args.chatId}` })
    );
  }

  if (chat.userId !== args.userId) {
    return yield* Effect.fail(
      new ChatStoreError({
        message: "You do not have permission to modify this chat.",
      })
    );
  }

  return chat;
});

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
export const verifyChatOwnership = Effect.fnUntraced(function* (args: {
  chatId: Id<"chats">;
  userId: Id<"users">;
}) {
  return yield* readOwnedChat(args);
});

/** Reads one message by stable client identifier. */
export const getMessageByIdentifier = Effect.fnUntraced(function* (args: {
  chatId: Id<"chats">;
  identifier: string;
}) {
  const reader = yield* DatabaseReader;

  return yield* reader
    .table("messages")
    .get("by_chatId_and_identifier", args.chatId, args.identifier)
    .pipe(Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)));
});

/** Inserts AI SDK message parts for a persisted message. */
export const insertParts = Effect.fnUntraced(function* (args: {
  messageId: Id<"messages">;
  parts: readonly MessagePartInput[];
}) {
  const writer = yield* DatabaseWriter;

  if (args.parts.length > MAX_CHAT_MESSAGE_PARTS) {
    return yield* Effect.fail(
      new ChatStoreError({
        message: `Chat message cannot have more than ${MAX_CHAT_MESSAGE_PARTS} parts.`,
      })
    );
  }

  return yield* Effect.forEach(args.parts, (part, order) =>
    writer.table("parts").insert({
      ...part,
      messageId: args.messageId,
      order,
    })
  );
});

/** Deletes all parts for a message within the bounded chat rewrite batch. */
const deletePartsForMessageBatch = Effect.fnUntraced(function* (
  messageId: Id<"messages">
) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const parts = yield* reader
    .table("parts")
    .index("by_messageId_and_order", (query) =>
      query.eq("messageId", messageId)
    )
    .take(MAX_CHAT_MESSAGE_PARTS + 1);

  for (const part of parts.slice(0, MAX_CHAT_MESSAGE_PARTS)) {
    yield* writer.table("parts").delete(part._id);
  }

  return { hasMore: parts.length > MAX_CHAT_MESSAGE_PARTS };
});

/** Deletes messages and parts from a chat transcript creation-time boundary. */
export const deleteMessageBatchFromPoint = Effect.fnUntraced(function* (args: {
  chatId: Id<"chats">;
  fromCreationTime: number;
}) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const messages = yield* reader
    .table("messages")
    .index("by_chatId", (query) =>
      query
        .eq("chatId", args.chatId)
        .gte("_creationTime", args.fromCreationTime)
    )
    .take(CHAT_TRANSCRIPT_REWRITE_MESSAGE_BATCH_SIZE);

  if (messages.length === 0) {
    return { hasMore: false };
  }

  for (const message of messages) {
    const partsBatch = yield* deletePartsForMessageBatch(message._id);

    if (partsBatch.hasMore) {
      return { hasMore: true };
    }

    yield* writer.table("messages").delete(message._id);
  }

  return {
    hasMore: messages.length === CHAT_TRANSCRIPT_REWRITE_MESSAGE_BATCH_SIZE,
  };
});

/** Loads one message page and attaches its ordered parts. */
export const hydrateMessagePage = Effect.fnUntraced(function* (
  messages: readonly Doc<"messages">[]
) {
  const reader = yield* DatabaseReader;
  return yield* Effect.forEach(messages, (message) =>
    Effect.gen(function* () {
      const parts = yield* reader
        .table("parts")
        .index("by_messageId_and_order", (query) =>
          query.eq("messageId", message._id)
        )
        .take(MAX_CHAT_MESSAGE_PARTS + 1);

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
});
