"use client";

import { Chat } from "@ai-sdk/react";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { DefaultChatTransport } from "ai";
import type { AiStore } from "@/components/ai/store/types";
import { getLocale, getPathname } from "@/lib/utils/browser";

interface CreateChatRuntimeOptions {
  apiUrl?: string;
  chatId: Id<"chats">;
  getModel: AiStore["getModel"];
  initialMessages: MyUIMessage[];
  onError: (error: Error) => void;
}

interface CreateChatTransportOptions {
  apiUrl?: string;
  getModel: AiStore["getModel"];
}

/** Creates the chat transport body expected by the `/api/chat` route. */
export function createChatTransport({
  apiUrl = "/api/chat",
  getModel,
}: CreateChatTransportOptions) {
  return new DefaultChatTransport({
    api: apiUrl,
    prepareSendMessagesRequest: ({ id, messages }) => {
      const lastMessage = messages.at(-1);

      return {
        body: {
          id,
          locale: getLocale(),
          message: lastMessage,
          model: getModel(),
          slug: getPathname(),
        },
      };
    },
  });
}

/** Creates one AI SDK chat runtime wired to Nakafa's chat route contract. */
export function createChatRuntime({
  apiUrl = "/api/chat",
  chatId,
  getModel,
  initialMessages,
  onError,
}: CreateChatRuntimeOptions) {
  return new Chat<MyUIMessage>({
    id: chatId,
    messages: initialMessages,
    onError,
    transport: createChatTransport({ apiUrl, getModel }),
  });
}
