"use client";

import { type UseChatHelpers, useChat as useAIChat } from "@ai-sdk/react";
import type { MyUIMessage } from "@repo/ai/types/message";
import { DefaultChatTransport } from "ai";
import { type ReactNode, useMemo } from "react";
import { toast } from "sonner";
import { createContext, useContextSelector } from "use-context-selector";
import { useAi } from "./use-ai";

type ChatContextValue = {
  chat: UseChatHelpers<MyUIMessage>;
};

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const getModel = useAi((state) => state.getModel);
  const getLocale = useAi((state) => state.getLocale);
  const getSlug = useAi((state) => state.getSlug);

  const chat = useAIChat<MyUIMessage>({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ messages: ms }) => {
        return {
          body: {
            messages: ms,
            locale: getLocale(),
            slug: getSlug(),
            model: getModel(),
          },
        };
      },
    }),
    experimental_throttle: 50,
    onError: ({ message }) => {
      toast.error(message, { position: "bottom-center" });
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
