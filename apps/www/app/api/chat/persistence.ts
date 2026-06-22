import type { ModelId } from "@repo/ai/config/model";
import { compressMessages } from "@repo/ai/lib/message";
import type {
  NinaContextSnapshot,
  NinaContextTransition,
} from "@repo/ai/nina/context";
import type { MyUIMessage } from "@repo/ai/types/message";
import { api as convexApi } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { CHAT_MESSAGES_PAGE_SIZE } from "@repo/backend/convex/chats/constants";
import { mapUIMessagePartsToDBParts } from "@repo/backend/convex/chats/messageParts/uiToDb";
import type { MessageWithPartsDoc } from "@repo/backend/convex/chats/schema";
import { mapDBMessagesToUIMessages } from "@repo/backend/convex/chats/utils";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { Effect } from "effect";

interface ChatMessagesPage {
  continueCursor: string;
  isDone: boolean;
  page: MessageWithPartsDoc[];
}

/** User-message persistence input with the Nina context metadata saved atomically. */
interface Save {
  chatId: Id<"chats"> | undefined;
  message: MyUIMessage;
  modelId: ModelId;
  ninaContextSnapshot: NinaContextSnapshot;
  ninaContextTransition: NinaContextTransition;
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
  ninaContextSnapshot,
  ninaContextTransition,
  token,
}: Save) {
  const dbParts = mapUIMessagePartsToDBParts({ messageParts: message.parts });

  if (chatId) {
    const existingMessage = yield* Effect.tryPromise(() =>
      fetchQuery(
        convexApi.chats.queries.getMessageMatch,
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
            convexApi.chats.mutations.deleteMessageBatch,
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
        convexApi.chats.mutations.saveMessage,
        {
          message: {
            chatId,
            role: message.role,
            identifier: message.id,
            modelId,
            ninaContextSnapshot,
            ninaContextTransition,
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
      convexApi.chats.mutations.createChatWithMessage,
      {
        type: "study",
        message: {
          role: message.role,
          identifier: message.id,
          modelId,
          ninaContextSnapshot,
          ninaContextTransition,
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
        convexApi.chats.queries.loadMessagesPage,
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
