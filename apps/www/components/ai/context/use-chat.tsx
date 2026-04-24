"use client";

import { type UseChatHelpers, useChat as useAiChat } from "@ai-sdk/react";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { useTranslations } from "next-intl";
import { type PropsWithChildren, useMemo } from "react";
import { createContext, useContextSelector } from "use-context-selector";
import { useAi } from "@/components/ai/context/use-ai";
import { createChatTransport } from "@/components/ai/helpers/runtime";
import { reportChatRuntimeError } from "@/components/ai/helpers/runtime-error";

interface ChatContextValue {
  chat: UseChatHelpers<MyUIMessage>;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

/**
 * Provides the shared AI SDK chat instance for one chat route or sheet.
 *
 * Source of truth:
 * `apps/www/node_modules/ai/src/ui/http-chat-transport.ts`
 * throws `new Error(await response.text())` for non-2xx responses, so this
 * provider can compare the exact backend error code returned by `/api/chat`.
 *
 * Related docs:
 * https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat
 */
export function ChatProvider({
  chatId,
  initialMessages,
  apiUrl = "/api/chat",
  children,
}: PropsWithChildren<{
  chatId: Id<"chats">;
  initialMessages: MyUIMessage[];
  apiUrl?: string;
}>) {
  const t = useTranslations("Ai");

  const chatSession = useAi((state) => state.chatSession);
  const getModel = useAi((state) => state.getModel);
  const reusableChatRuntime =
    chatSession?.chatId === chatId ? chatSession.runtime : undefined;

  /** Handles one failed chat request with localized user feedback. */
  function handleError(error: Error) {
    reportChatRuntimeError({
      error,
      fallbackMessage: t("error-message"),
      insufficientCreditsMessage: t("insufficient-credits"),
    });
  }

  const chat = useAiChat<MyUIMessage>(
    reusableChatRuntime
      ? { chat: reusableChatRuntime }
      : {
          id: chatId,
          messages: initialMessages,
          transport: createChatTransport({ apiUrl, getModel }),
          onError: handleError,
        }
  );

  const value = useMemo(
    () => ({
      chat,
    }),
    [chat]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

/** Reads one selected slice of the active AI SDK chat. */
export function useChat<T>(selector: (state: ChatContextValue) => T) {
  const context = useContextSelector(ChatContext, (value) => value);
  if (!context) {
    throw new Error("useChat must be used within ChatProvider");
  }
  return selector(context);
}
