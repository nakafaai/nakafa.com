import { getModelCreditCost } from "@repo/ai/config/models";
import { DEFAULT_TITLE } from "@repo/ai/features/constants";
import type { Id } from "@repo/backend/confect/_generated/dataModel";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import {
  deleteMessageBatchFromPoint,
  getMessageByIdentifier,
  insertParts,
  verifyChatOwnership,
} from "@repo/backend/confect/modules/chat/chatStore.service";
import type {
  ChatType,
  ChatVisibility,
  MessagePartInput,
  MessageRole,
  ModelId,
} from "@repo/backend/confect/modules/chat/chats.tables";
import { getCreditResetGrantTransaction } from "@repo/backend/confect/modules/commerce/credits.policy";
import { resolveUserCreditState } from "@repo/backend/confect/modules/commerce/credits.service";
import { requireAppUser } from "@repo/backend/confect/modules/identity/auth/session.service";
import { Clock, Duration, Effect, Schema } from "effect";

export class ChatMutationError extends Schema.TaggedError<ChatMutationError>()(
  "ChatMutationError",
  { message: Schema.String }
) {}

interface ChatMessageInput {
  readonly chatId: Id<"chats">;
  readonly credits?: number;
  readonly identifier: string;
  readonly inputTokens?: number;
  readonly modelId?: ModelId;
  readonly outputTokens?: number;
  readonly role: MessageRole;
  readonly totalTokens?: number;
}

/** Creates a private chat owned by the current user. */
export const createChat = Effect.fnUntraced(function* (args: {
  title?: string;
  type: ChatType;
}) {
  const writer = yield* DatabaseWriter;
  const user = yield* requireAppUser();
  const updatedAt = yield* Clock.currentTimeMillis;

  return yield* writer.table("chats").insert({
    title: args.title || DEFAULT_TITLE,
    type: args.type,
    updatedAt,
    userId: user.appUser._id,
    visibility: "private",
  });
});

/** Updates the title for a chat owned by the current user. */
export const updateChatTitle = Effect.fnUntraced(function* (args: {
  chatId: Id<"chats">;
  title: string;
}) {
  const writer = yield* DatabaseWriter;
  const user = yield* requireAppUser();
  const chat = yield* verifyChatOwnership({
    chatId: args.chatId,
    userId: user.appUser._id,
  });

  yield* writer.table("chats").patch(chat._id, { title: args.title });
  return chat._id;
});

/** Updates the visibility for a chat owned by the current user. */
export const updateChatVisibility = Effect.fnUntraced(function* (args: {
  chatId: Id<"chats">;
  visibility: ChatVisibility;
}) {
  const writer = yield* DatabaseWriter;
  const user = yield* requireAppUser();
  const chat = yield* verifyChatOwnership({
    chatId: args.chatId,
    userId: user.appUser._id,
  });

  yield* writer.table("chats").patch(chat._id, {
    visibility: args.visibility,
  });
  return chat._id;
});

/** Inserts one message and its persisted parts. */
export const saveMessage = Effect.fnUntraced(function* (args: {
  message: ChatMessageInput;
  parts: readonly MessagePartInput[];
}) {
  const writer = yield* DatabaseWriter;
  const user = yield* requireAppUser();

  yield* verifyChatOwnership({
    chatId: args.message.chatId,
    userId: user.appUser._id,
  });

  const messageId = yield* writer.table("messages").insert({
    chatId: args.message.chatId,
    identifier: args.message.identifier,
    modelId: args.message.modelId,
    role: args.message.role,
  });
  const partIds = yield* insertParts({ messageId, parts: args.parts });

  return { messageId, partIds };
});

/** Deletes messages and parts from one transcript creation-time boundary. */
export const deleteMessageBatch = Effect.fnUntraced(function* (args: {
  chatId: Id<"chats">;
  fromCreationTime: number;
}) {
  const user = yield* requireAppUser();

  yield* verifyChatOwnership({
    chatId: args.chatId,
    userId: user.appUser._id,
  });

  return yield* deleteMessageBatchFromPoint(args);
});

/** Creates a private chat and inserts its first message. */
export const createChatWithMessage = Effect.fnUntraced(function* (args: {
  message: Omit<ChatMessageInput, "chatId">;
  parts: readonly MessagePartInput[];
  title?: string;
  type: ChatType;
}) {
  const writer = yield* DatabaseWriter;
  const user = yield* requireAppUser();
  const updatedAt = yield* Clock.currentTimeMillis;
  const chatId = yield* writer.table("chats").insert({
    title: args.title || DEFAULT_TITLE,
    type: args.type,
    updatedAt,
    userId: user.appUser._id,
    visibility: "private",
  });
  const messageId = yield* writer.table("messages").insert({
    chatId,
    identifier: args.message.identifier,
    modelId: args.message.modelId,
    role: args.message.role,
  });
  const partIds = yield* insertParts({ messageId, parts: args.parts });

  return { chatId, messageId, partIds };
});

/** Deletes a chat owned by the current user. */
export const deleteChat = Effect.fnUntraced(function* (args: {
  chatId: Id<"chats">;
}) {
  const writer = yield* DatabaseWriter;
  const user = yield* requireAppUser();
  const chat = yield* verifyChatOwnership({
    chatId: args.chatId,
    userId: user.appUser._id,
  });

  const scheduler = yield* Scheduler;

  yield* writer.table("chats").delete(chat._id);
  yield* scheduler.runAfter(
    Duration.zero,
    refs.internal.triggers.chats.cleanup.cleanupDeletedChat,
    { chatId: chat._id }
  );

  return null;
});

/** Saves an assistant message, rewrites duplicate identifiers, and charges credits. */
export const saveAssistantResponse = Effect.fnUntraced(function* (args: {
  message: ChatMessageInput;
  parts: readonly MessagePartInput[];
  userId: Id<"users">;
}) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const appUser = yield* reader
    .table("users")
    .get(args.userId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (!appUser) {
    return yield* Effect.fail(
      new ChatMutationError({ message: "User not found." })
    );
  }

  yield* verifyChatOwnership({
    chatId: args.message.chatId,
    userId: appUser._id,
  });

  if (args.message.identifier) {
    const existingMessage = yield* getMessageByIdentifier({
      chatId: args.message.chatId,
      identifier: args.message.identifier,
    });

    if (existingMessage) {
      const deleteResult = yield* deleteMessageBatchFromPoint({
        chatId: args.message.chatId,
        fromCreationTime: existingMessage._creationTime,
      });

      if (deleteResult.hasMore) {
        return yield* Effect.fail(
          new ChatMutationError({
            message:
              "Assistant response rewrite exceeded the supported batch size.",
          })
        );
      }
    }
  }

  const now = yield* Clock.currentTimeMillis;
  const effectiveCredits = args.message.modelId
    ? yield* resolveUserCreditState({ now, user: appUser })
    : null;
  const credits = args.message.modelId
    ? getModelCreditCost(args.message.modelId)
    : 0;
  const newBalance = effectiveCredits
    ? effectiveCredits.credits - credits
    : appUser.credits;
  const nextResetTimestamp =
    effectiveCredits?.creditsResetAt ?? appUser.creditsResetAt;
  const creditResetGrant = effectiveCredits
    ? getCreditResetGrantTransaction(appUser, effectiveCredits)
    : null;
  const messageId = yield* writer.table("messages").insert({
    chatId: args.message.chatId,
    credits: args.message.modelId ? credits : undefined,
    identifier: args.message.identifier,
    inputTokens: args.message.inputTokens,
    modelId: args.message.modelId,
    outputTokens: args.message.outputTokens,
    role: args.message.role,
    totalTokens: args.message.totalTokens,
  });
  const partIds = yield* insertParts({ messageId, parts: args.parts });

  const modelId = args.message.modelId;

  if (!modelId) {
    return { credits, messageId, newBalance, partIds };
  }

  yield* writer.table("users").patch(appUser._id, {
    credits: newBalance,
    creditsResetAt: nextResetTimestamp,
  });

  if (creditResetGrant) {
    yield* writer.table("creditTransactions").insert({
      userId: appUser._id,
      ...creditResetGrant,
    });
  }

  yield* writer.table("creditTransactions").insert({
    amount: -credits,
    balanceAfter: newBalance,
    metadata: {
      chatId: args.message.chatId,
      messageId,
      modelId,
      ...(args.message.inputTokens === undefined
        ? {}
        : { inputTokens: args.message.inputTokens }),
      ...(args.message.outputTokens === undefined
        ? {}
        : { outputTokens: args.message.outputTokens }),
      ...(args.message.totalTokens === undefined
        ? {}
        : { totalTokens: args.message.totalTokens }),
    },
    type: "usage",
    userId: appUser._id,
  });

  return { credits, messageId, newBalance, partIds };
});
