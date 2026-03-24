import { compressMessages } from "@repo/ai/lib/utils";
import type { MyUIMessage } from "@repo/ai/types/message";
import { api as convexApi } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { CHAT_MESSAGES_PAGE_SIZE } from "@repo/backend/convex/chats/constants";
import { mapUIMessagePartsToDBParts } from "@repo/backend/convex/chats/messageParts/uiToDb";
import type { MessageWithPartsDoc } from "@repo/backend/convex/chats/schema";
import { mapDBMessagesToUIMessages } from "@repo/backend/convex/chats/utils";
import { fetchMutation, fetchQuery } from "convex/nextjs";

interface ChatMessagesPage {
  continueCursor: string;
  isDone: boolean;
  page: MessageWithPartsDoc[];
}

/**
 * Persists the user message to an existing chat, or creates a new chat with
 * the message if no chatId is provided.
 *
 * @returns The resolved chat ID (either the existing one or the newly created one).
 */
export async function saveOrCreateChat({
  chatId,
  message,
  token,
}: {
  chatId: Id<"chats"> | undefined;
  message: MyUIMessage;
  token: string;
}): Promise<Id<"chats">> {
  const dbParts = mapUIMessagePartsToDBParts({ messageParts: message.parts });

  if (chatId) {
    const existingMessage = await fetchQuery(
      convexApi.chats.queries.getMessageMatch,
      {
        chatId,
        identifier: message.id,
      },
      { token }
    );

    if (existingMessage) {
      let hasMore = true;

      while (hasMore) {
        const result = await fetchMutation(
          convexApi.chats.mutations.deleteMessageBatch,
          {
            chatId,
            fromCreationTime: existingMessage.creationTime,
          },
          { token }
        );

        hasMore = result.hasMore;
      }
    }

    await fetchMutation(
      convexApi.chats.mutations.saveMessage,
      {
        message: {
          chatId,
          role: message.role,
          identifier: message.id,
        },
        parts: dbParts,
      },
      { token }
    );
    return chatId;
  }

  const result = await fetchMutation(
    convexApi.chats.mutations.createChatWithMessage,
    {
      type: "study",
      message: {
        role: message.role,
        identifier: message.id,
      },
      parts: dbParts,
    },
    { token }
  );
  return result.chatId;
}

/**
 * Fetches a chat transcript page-by-page until the retained context is enough
 * for model input. Older pages stop loading once compression would trim them.
 *
 * @returns An ordered array of UI messages for the given chat context.
 */
export async function loadMessages({
  chatId,
  token,
}: {
  chatId: Id<"chats">;
  token: string;
}): Promise<MyUIMessage[]> {
  let cursor: string | null = null;
  let messages: MyUIMessage[] = [];

  while (true) {
    const page: ChatMessagesPage = await fetchQuery(
      convexApi.chats.queries.loadMessagesPage,
      {
        chatId,
        paginationOpts: {
          cursor,
          numItems: CHAT_MESSAGES_PAGE_SIZE,
        },
      },
      { token }
    );
    const nextMessages = mapDBMessagesToUIMessages([...page.page].reverse());
    messages = [...nextMessages, ...messages];

    const compressed = compressMessages(messages);

    if (compressed.messages.length < messages.length || page.isDone) {
      return compressed.messages;
    }

    cursor = page.continueCursor;
  }
}
