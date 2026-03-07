import type { MyUIMessage } from "@repo/ai/types/message";
import { api as convexApi } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import {
  mapDBMessagesToUIMessages,
  mapUIMessagePartsToDBParts,
} from "@repo/backend/convex/chats/utils";
import { fetchMutation, fetchQuery } from "convex/nextjs";

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
 * Fetches all messages for a chat from the database and maps them to UI
 * message format.
 *
 * @returns An ordered array of UI messages for the given chat.
 */
export async function loadMessages({
  chatId,
  token,
}: {
  chatId: Id<"chats">;
  token: string;
}): Promise<MyUIMessage[]> {
  const rawMessages = await fetchQuery(
    convexApi.chats.queries.loadMessages,
    { chatId },
    { token }
  );
  return mapDBMessagesToUIMessages(rawMessages);
}
