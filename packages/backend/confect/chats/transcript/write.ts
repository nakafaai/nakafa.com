import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  CHAT_TRANSCRIPT_REWRITE_MESSAGE_BATCH_SIZE,
  MAX_CHAT_MESSAGE_PARTS,
} from "@repo/backend/confect/chats/constants";
import type { partValidator } from "@repo/backend/confect/chats/schema";
import { TranscriptLimitExceeded } from "@repo/backend/confect/chats/transcript/spec";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Effect, type Schema } from "effect";

type PartInput = Omit<Schema.Schema.Type<typeof partValidator>, "messageId">;

/** Deletes one bounded transcript page, leaving oversized messages resumable. */
export const deleteMessageBatchFromPoint = Effect.fn(
  "chats.transcript.deleteBatch"
)(function* (chatId: Id<"chats">, fromCreationTime: number) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const messages = yield* reader
    .table("messages")
    .index("by_chatId", (q) =>
      q.eq("chatId", chatId).gte("_creationTime", fromCreationTime)
    )
    .take(CHAT_TRANSCRIPT_REWRITE_MESSAGE_BATCH_SIZE + 1)
    .pipe(Effect.orDie);
  for (const message of messages.slice(
    0,
    CHAT_TRANSCRIPT_REWRITE_MESSAGE_BATCH_SIZE
  )) {
    const parts = yield* reader
      .table("messageParts")
      .index("by_messageId_and_order", (q) => q.eq("messageId", message._id))
      .take(MAX_CHAT_MESSAGE_PARTS + 1)
      .pipe(Effect.orDie);
    for (const part of parts.slice(0, MAX_CHAT_MESSAGE_PARTS)) {
      yield* writer.table("messageParts").delete(part._id);
    }
    if (parts.length > MAX_CHAT_MESSAGE_PARTS) {
      return { hasMore: true };
    }
    yield* writer.table("messages").delete(message._id);
  }
  return {
    hasMore: messages.length > CHAT_TRANSCRIPT_REWRITE_MESSAGE_BATCH_SIZE,
  };
});

/** Resolve an idempotent UI identifier without hiding duplicate stored rows. */
export const getMessageByIdentifier = Effect.fn("chats.transcript.find")(
  function* (chatId: Id<"chats">, identifier: string) {
    const reader = yield* DatabaseReader;
    return yield* reader
      .table("messages")
      .get("by_chatId_and_identifier", chatId, identifier)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
  }
);

/** Reject oversized rewrites so Convex rolls back every partial deletion. */
export const rewriteTranscript = Effect.fn("chats.transcript.rewrite")(
  function* (
    chatId: Id<"chats">,
    identifier: string,
    source: "user" | "assistant"
  ) {
    const existing = yield* getMessageByIdentifier(chatId, identifier);
    if (!existing) {
      return;
    }
    const result = yield* deleteMessageBatchFromPoint(
      chatId,
      existing._creationTime
    );
    if (!result.hasMore) {
      return;
    }
    return yield* new TranscriptLimitExceeded(
      source === "user"
        ? {
            code: "CHAT_USER_MESSAGE_REWRITE_EXCEEDED",
            message: "User message rewrite exceeded the supported batch size.",
          }
        : {
            code: "CHAT_ASSISTANT_RESPONSE_REWRITE_EXCEEDED",
            message:
              "Assistant response rewrite exceeded the supported batch size.",
          }
    );
  }
);

/** Insert the complete bounded message payload in the caller's transaction. */
export const insertParts = Effect.fn("chats.transcript.insertParts")(function* (
  messageId: Id<"messages">,
  parts: readonly PartInput[]
) {
  if (parts.length > MAX_CHAT_MESSAGE_PARTS) {
    return yield* new TranscriptLimitExceeded({
      code: "CHAT_PART_LIMIT_EXCEEDED",
      message: `Chat message cannot have more than ${MAX_CHAT_MESSAGE_PARTS} parts.`,
    });
  }
  const writer = yield* DatabaseWriter;
  const partIds: Id<"messageParts">[] = [];
  for (const part of parts) {
    partIds.push(
      yield* writer
        .table("messageParts")
        .insert({ ...part, messageId })
        .pipe(Effect.orDie)
    );
  }
  return partIds;
});
