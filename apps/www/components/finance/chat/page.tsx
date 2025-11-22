"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@repo/design-system/components/ui/resizable";
import { Authenticated, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef } from "react";
import { FinanceChatConversation } from "@/components/finance/chat/conversation";
import {
  FinanceCurrentChatProvider,
  useFinanceCurrentChat,
} from "@/components/finance/chat/provider";
import { FinanceDatasetTable } from "@/components/finance/chat/table";
import { useAi } from "@/lib/context/use-ai";
import { ChatProvider, useChat } from "@/lib/context/use-chat";

export function FinanceChatPage({ chatId }: { chatId: Id<"chats"> }) {
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
        <FinanceCurrentChatProvider chatId={chatId}>
          <FinanceChatMain />
        </FinanceCurrentChatProvider>
      </ErrorBoundary>
    </Authenticated>
  );
}

function FinanceChatMain() {
  const chat = useFinanceCurrentChat((s) => s.chat);
  const messages = useFinanceCurrentChat((s) => s.messages);

  if (!(chat && messages)) {
    return <div className="relative flex size-full flex-col overflow-hidden" />;
  }

  return (
    <ChatProvider
      apiUrl="/api/chat/finance"
      chatId={chat._id}
      initialMessages={messages}
    >
      <FinanceChatPageContent />
    </ChatProvider>
  );
}

function FinanceChatPageContent() {
  const query = useAi((state) => state.query);
  const setQuery = useAi((state) => state.setQuery);
  const setText = useAi((state) => state.setText);
  const chat = useFinanceCurrentChat((s) => s.chat);

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

  if (!chat) {
    return null;
  }

  return (
    <ResizablePanelGroup className="max-h-svh min-h-svh" direction="horizontal">
      <ResizablePanel defaultSize={30} maxSize={50} minSize={20}>
        <FinanceChatConversation />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={70} maxSize={80} minSize={50}>
        <FinanceChatDatasetView chatId={chat._id} />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

function FinanceChatDatasetView({ chatId }: { chatId: Id<"chats"> }) {
  const dataset = useQuery(api.datasets.queries.getDataset, { chatId });

  // Loading state
  if (dataset === undefined) {
    return (
      <div className="size-full p-2">
        <div className="flex size-full flex-col items-center justify-center overflow-hidden rounded-md border">
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // No dataset yet
  if (dataset === null) {
    return (
      <div className="size-full p-2">
        <div className="flex size-full flex-col items-center justify-center overflow-hidden rounded-md border">
          <div className="max-w-sm text-center">
            <p className="text-muted-foreground text-sm">
              No dataset yet. Ask me to research companies, organizations, or
              any entities to get started.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show table
  return (
    <div className="size-full p-2">
      <div className="size-full overflow-auto rounded-md border">
        <FinanceDatasetTable datasetId={dataset._id} />
      </div>
    </div>
  );
}
