"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { Authenticated, useQuery } from "convex/react";
import { useCallback, useEffect, useRef } from "react";
import { useAi } from "@/lib/context/use-ai";
import { ChatProvider, useChat } from "@/lib/context/use-chat";
import { AiChat } from "./chat";
import { useChatId } from "./chat-provider";

export function AiChatPage() {
  return (
    <Authenticated>
      <AiChatMain />
    </Authenticated>
  );
}

function AiChatMain() {
  const chatId = useChatId((s) => s.chatId);
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

  return <AiChat />;
}
