"use client";

import { SquareLock01Icon } from "@hugeicons/core-free-icons";
import { useDocumentTitle } from "@mantine/hooks";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@repo/design-system/components/ui/empty";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Unauthenticated } from "convex/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useEffectEvent, useRef } from "react";
import { AuthGoogle } from "@/components/auth/google";
import { useAi } from "@/lib/context/use-ai";
import { ChatProvider, useChat } from "@/lib/context/use-chat";
import { AiChat } from "./chat";
import { CurrentChatProvider, useCurrentChat } from "./chat-provider";

export function AiChatPage({ chatId }: { chatId: Id<"chats"> }) {
  return (
    <ErrorBoundary fallback={<AiChatPageError chatId={chatId} />}>
      <CurrentChatProvider chatId={chatId}>
        <AiChatMain />
      </CurrentChatProvider>
    </ErrorBoundary>
  );
}

function AiChatPageError({ chatId }: { chatId: Id<"chats"> }) {
  const t = useTranslations("Ai");

  return (
    <div className="relative flex size-full flex-col overflow-hidden">
      <div className="flex size-full flex-col items-center justify-center">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeIcons icon={SquareLock01Icon} />
            </EmptyMedia>
            <EmptyTitle>{t("private-chat-error")}</EmptyTitle>
            <EmptyDescription>
              {t("private-chat-error-description")}
            </EmptyDescription>
          </EmptyHeader>
          <Unauthenticated>
            <AuthGoogle redirect={`/chat/${chatId}`} />
          </Unauthenticated>
        </Empty>
      </div>
    </div>
  );
}

function AiChatMain() {
  const chat = useCurrentChat((s) => s.chat);
  const messages = useCurrentChat((s) => s.messages);

  useDocumentTitle(chat?.title ?? "");

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

  const lastProcessedQuery = useRef<string | null>(null);

  const handleClearQuery = useCallback(() => {
    setQuery("");
    setText("");
  }, [setQuery, setText]);

  const handleQuery = useEffectEvent((text: string) => {
    sendMessage({ text });
    handleClearQuery();
  });

  useEffect(() => {
    if (query && query !== lastProcessedQuery.current) {
      lastProcessedQuery.current = query;
      handleQuery(query);
    }
  }, [query]);

  return <AiChat />;
}
