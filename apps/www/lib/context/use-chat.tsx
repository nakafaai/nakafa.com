"use client";

import { type UseChatHelpers, useChat as useAiChat } from "@ai-sdk/react";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { DefaultChatTransport } from "ai";
import { useTranslations } from "next-intl";
import {
  type PropsWithChildren,
  useEffect,
  useEffectEvent,
  useMemo,
} from "react";
import { toast } from "sonner";
import { createContext, useContextSelector } from "use-context-selector";
import { useAi } from "@/lib/context/use-ai";
import { getLocale, getPathname } from "@/lib/utils/browser";

interface ChatContextValue {
  chat: UseChatHelpers<MyUIMessage>;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

export function ChatProvider({
  chatId,
  initialMessages,
  apiUrl = "/api/chat",
  pendingQueryOwner,
  children,
}: PropsWithChildren<{
  chatId: Id<"chats">;
  initialMessages: MyUIMessage[];
  apiUrl?: string;
  pendingQueryOwner?: "page" | "sheet";
}>) {
  const t = useTranslations("Ai");

  const clearPendingQuery = useAi((state) => state.clearPendingQuery);
  const getModel = useAi((state) => state.getModel);
  const pendingQuery = useAi((state) => state.pendingQuery);
  const pendingQueryChatId = useAi((state) => state.pendingQueryChatId);
  const pendingOwner = useAi((state) => state.pendingQueryOwner);
  const setText = useAi((state) => state.setText);

  const chat = useAiChat<MyUIMessage>({
    id: chatId,
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: apiUrl,
      prepareSendMessagesRequest: ({ id, messages }) => {
        // send only the last message and chat id
        // we will then fetch message history (for our chatId) on server
        // and append this message for the full context to send to the model
        const lastMessage = messages.at(-1);

        return {
          body: {
            id,
            message: lastMessage,
            locale: getLocale(),
            slug: getPathname(),
            model: getModel(),
          },
        };
      },
    }),
    onError: (error) => {
      // Check for specific error codes in the error message
      // Our API returns JSON with error codes like { error: "INSUFFICIENT_CREDITS" }
      const errorMessage = error.message ?? "";

      if (errorMessage.includes("INSUFFICIENT_CREDITS")) {
        toast.error(t("insufficient-credits"), { position: "bottom-center" });
      } else {
        toast.error(t("error-message"), { position: "bottom-center" });
      }
    },
  });

  const consumePendingQuery = useEffectEvent((text: string) => {
    chat.sendMessage({ text });
    clearPendingQuery();
    setText("");
  });

  useEffect(() => {
    if (!pendingQueryOwner) {
      return;
    }

    if (pendingOwner !== pendingQueryOwner) {
      return;
    }

    if (pendingQueryChatId !== chatId || !pendingQuery) {
      return;
    }

    consumePendingQuery(pendingQuery);
  }, [
    chatId,
    pendingOwner,
    pendingQuery,
    pendingQueryChatId,
    pendingQueryOwner,
  ]);

  const value = useMemo(
    () => ({
      chat,
    }),
    [chat]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat<T>(selector: (state: ChatContextValue) => T) {
  const context = useContextSelector(ChatContext, (value) => value);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return selector(context);
}
