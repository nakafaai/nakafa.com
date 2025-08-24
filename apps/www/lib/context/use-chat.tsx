"use client";

import { type UseChatHelpers, useChat as useAIChat } from "@ai-sdk/react";
import { useIsomorphicEffect } from "@mantine/hooks";
import type { MyUIMessage } from "@repo/ai/lib/types";
import { DefaultChatTransport } from "ai";
import { type ReactNode, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { createContext, useContextSelector } from "use-context-selector";
import { useAi } from "./use-ai";

type ChatContextValue = {
  chat: UseChatHelpers<MyUIMessage>;
  clearMessages: () => void;
};

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const setCurrentMessages = useAi((state) => state.setCurrentMessages);
  const appendCurrentMessages = useAi((state) => state.appendCurrentMessages);
  const currentMessages = useAi((state) => state.currentMessages);

  const chat = useAIChat<MyUIMessage>({
    messages: currentMessages,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ messages: ms }) => {
        const currentUrl = window.location.href;
        const url = new URL(currentUrl);

        const locale = url.pathname.split("/")[1];
        const slug = `/${url.pathname.split("/").slice(2).join("/")}`;

        setCurrentMessages(ms);

        return {
          body: {
            messages: ms,
            url: currentUrl,
            locale,
            slug,
          },
        };
      },
    }),
    experimental_throttle: 50,
    onError: ({ message }) => {
      toast.error(message, { position: "bottom-center" });
    },
    onFinish: ({ message }) => {
      appendCurrentMessages(message);
    },
  });

  const clearMessages = useCallback(() => {
    chat.setMessages([]);
    setCurrentMessages([]);
  }, [setCurrentMessages, chat.setMessages]);

  useIsomorphicEffect(() => {
    chat.setMessages(currentMessages);
  }, [currentMessages]);

  const value = useMemo(
    () => ({
      chat,
      clearMessages,
    }),
    [chat, clearMessages]
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
