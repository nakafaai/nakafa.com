"use client";

import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { Authenticated } from "convex/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef } from "react";
import { useAi } from "@/lib/context/use-ai";
import { ChatProvider, useChat } from "@/lib/context/use-chat";
import { AiChat } from "./chat";
import { CurrentChatProvider, useCurrentChat } from "./chat-provider";

export function AiChatPage({ chatId }: { chatId: Id<"chats"> }) {
  const t = useTranslations("Ai");
  return (
    <Authenticated>
      <ErrorBoundary
        fallback={
          <div className="relative flex size-full flex-col overflow-hidden">
            <div className="flex size-full flex-col items-center justify-center">
              <div className="mx-6 flex max-w-sm flex-col items-center justify-center gap-2 rounded-xl border p-4 shadow-sm">
                <h1 className="font-semibold text-xl">
                  {t("private-chat-error")}
                </h1>
                <p className="text-center text-muted-foreground text-sm">
                  {t("private-chat-error-description")}
                </p>
              </div>
            </div>
          </div>
        }
      >
        <CurrentChatProvider chatId={chatId}>
          <AiChatMain />
        </CurrentChatProvider>
      </ErrorBoundary>
    </Authenticated>
  );
}

function AiChatMain() {
  const chat = useCurrentChat((s) => s.chat);
  const messages = useCurrentChat((s) => s.messages);

  if (!(chat && messages)) {
    return <div className="relative flex size-full flex-col overflow-hidden" />;
  }

  return (
    <ChatProvider chatId={chat._id} initialMessages={messages}>
      <AiChatPageContent />
    </ChatProvider>
  );
}

function AiChatPageContent() {
  const query = useAi((state) => state.query);
  const setQuery = useAi((state) => state.setQuery);
  const setText = useAi((state) => state.setText);

  const sendMessage = useChat((state) => state.chat.sendMessage);

  const hasProcessedQuery = useRef(false);

  const handleClearQuery = useCallback(() => {
    setQuery("");
    setText("");
  }, [setQuery, setText]);

  useEffect(() => {
    if (query && !hasProcessedQuery.current) {
      hasProcessedQuery.current = true;
      sendMessage({
        text: query,
      });
      handleClearQuery();
    }
  }, [query, sendMessage, handleClearQuery]);

  return <AiChat />;
}
