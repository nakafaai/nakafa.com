"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Authenticated, useQuery } from "convex/react";
import { useCallback, useEffect, useRef } from "react";
import { useAi } from "@/lib/context/use-ai";
import { ChatProvider, useChat } from "@/lib/context/use-chat";
import { AiChat } from "./chat";

type Props = {
  chatId: Id<"chats">;
};

export function AiChatPage({ chatId }: Props) {
  return (
    <Authenticated>
      <AiChatMain chatId={chatId} />
    </Authenticated>
  );
}

function AiChatMain({ chatId }: Props) {
  const messages = useQuery(api.chats.queries.loadMessages, {
    chatId,
  });

  if (!messages) {
    return null;
  }

  return (
    <ChatProvider chatId={chatId} initialMessages={messages}>
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

  return (
    <main className="h-[calc(100svh-4rem)] lg:h-svh">
      <AiChat />
    </main>
  );
}
