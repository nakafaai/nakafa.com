import type { ModelId } from "@repo/ai/config/models";
import { compressMessages } from "@repo/ai/lib/message";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { Id } from "@repo/backend/confect/_generated/dataModel";
import refs from "@repo/backend/confect/_generated/refs";
import { CHAT_MESSAGES_PAGE_SIZE } from "@repo/backend/confect/modules/chat/constants";
import { mapUIMessagePartsToDBParts } from "@repo/backend/confect/modules/chat/messageParts/uiToDb";
import type { MessageWithPartsDoc } from "@repo/backend/confect/modules/chat/messages";
import { mapDBMessagesToUIMessages } from "@repo/backend/confect/modules/chat/messages";
import { toConvexReference } from "@repo/backend/confect/modules/shared/convexReferences";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { Effect } from "effect";

interface ChatMessagesPage {
  continueCursor: string;
  isDone: boolean;
  page: MessageWithPartsDoc[];
}

interface Save {
  chatId: Id<"chats"> | undefined;
  message: MyUIMessage;
  modelId: ModelId;
  token: string;
}

interface Load {
  chatId: Id<"chats">;
  token: string;
}

/**
 * Persists the user message to an existing chat, or creates a new chat with
 * the message if no chatId is provided.
 *
 * @returns The resolved chat ID (either the existing one or the newly created one).
 */
export const saveOrCreateChat = Effect.fn("chat.saveOrCreateChat")(function* ({
  chatId,
  message,
  modelId,
  token,
}: Save) {
  const dbParts = mapUIMessagePartsToDBParts({ messageParts: message.parts });

  if (chatId) {
    const existingMessage = yield* Effect.tryPromise(() =>
      fetchQuery(
        toConvexReference(refs.public.chats.queries.getMessageMatch),
        {
          chatId,
          identifier: message.id,
        },
        { token }
      )
    );

    if (existingMessage) {
      let hasMore = true;

      while (hasMore) {
        const result = yield* Effect.tryPromise(() =>
          fetchMutation(
            toConvexReference(refs.public.chats.mutations.deleteMessageBatch),
            {
              chatId,
              fromCreationTime: existingMessage.creationTime,
            },
            { token }
          )
        );

        hasMore = result.hasMore;
      }
    }

    yield* Effect.tryPromise(() =>
      fetchMutation(
        toConvexReference(refs.public.chats.mutations.saveMessage),
        {
          message: {
            chatId,
            role: message.role,
            identifier: message.id,
            modelId,
          },
          parts: dbParts,
        },
        { token }
      )
    );
    return chatId;
  }

  const result = yield* Effect.tryPromise(() =>
    fetchMutation(
      toConvexReference(refs.public.chats.mutations.createChatWithMessage),
      {
        type: "study",
        message: {
          role: message.role,
          identifier: message.id,
          modelId,
        },
        parts: dbParts,
      },
      { token }
    )
  );
  return result.chatId;
});

/**
 * Fetches a chat transcript page-by-page until the retained context is enough
 * for model input. Older pages stop loading once compression would trim them.
 *
 * @returns An ordered array of UI messages for the given chat context.
 */
export const loadMessages = Effect.fn("chat.loadMessages")(function* ({
  chatId,
  token,
}: Load) {
  let cursor: string | null = null;
  let messages: MyUIMessage[] = [];

  while (true) {
    const page: ChatMessagesPage = yield* Effect.tryPromise(() =>
      fetchQuery(
        toConvexReference(refs.public.chats.queries.loadMessagesPage),
        {
          chatId,
          paginationOpts: {
            cursor,
            numItems: CHAT_MESSAGES_PAGE_SIZE,
          },
        },
        { token }
      )
    );
    const nextMessages = mapDBMessagesToUIMessages([...page.page].reverse());
    messages = [...nextMessages, ...messages];

    const compressed = compressMessages(messages);

    if (compressed.messages.length < messages.length || page.isDone) {
      return compressed.messages;
    }

    cursor = page.continueCursor;
  }
});
