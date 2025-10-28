"use client";

import { type UseChatHelpers, useChat as useAiChat } from "@ai-sdk/react";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { DefaultChatTransport } from "ai";
import { useTranslations } from "next-intl";
import { type PropsWithChildren, useMemo } from "react";
import { toast } from "sonner";
import { createContext, useContextSelector } from "use-context-selector";
import { useAi } from "./use-ai";

type ChatContextValue = {
  chat: UseChatHelpers<MyUIMessage>;
};

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

export function ChatProvider({
  chatId,
  initialMessages,
  children,
}: PropsWithChildren<{ chatId: Id<"chats">; initialMessages: MyUIMessage[] }>) {
  const t = useTranslations("Ai");

  const getModel = useAi((state) => state.getModel);
  const getLocale = useAi((state) => state.getLocale);
  const getSlug = useAi((state) => state.getSlug);

  const chat = useAiChat<MyUIMessage>({
    id: chatId,
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ messages }) => {
        // send only the last message and chat id
        // we will then fetch message history (for our chatId) on server
        // and append this message for the full context to send to the model
        const lastMessage = messages.at(-1);

        return {
          body: {
            message: lastMessage,
            chatId,
            locale: getLocale(),
            slug: getSlug(),
            model: getModel(),
          },
        };
      },
    }),
    onError: ({ message }) => {
      toast.error(message || t("error-message"), { position: "bottom-center" });
    },
  });

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
