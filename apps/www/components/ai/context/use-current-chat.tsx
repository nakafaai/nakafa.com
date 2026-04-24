"use client";

import type { MyUIMessage } from "@repo/ai/types/message";
import { api } from "@repo/backend/convex/_generated/api";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import { CHAT_MESSAGES_PAGE_SIZE } from "@repo/backend/convex/chats/constants";
import { mapDBMessagesToUIMessages } from "@repo/backend/convex/chats/utils";
import {
  type UsePaginatedQueryReturnType,
  usePaginatedQuery,
  useQuery,
} from "convex/react";
import { type PropsWithChildren, useMemo } from "react";
import { createContext, useContextSelector } from "use-context-selector";

type ChatMessagesQueryResult = UsePaginatedQueryReturnType<
  typeof api.chats.queries.loadMessagesPage
>;

interface ChatContextValue {
  chat: Doc<"chats"> | undefined;
  loadMoreMessages: ChatMessagesQueryResult["loadMore"];
  messageStatus: ChatMessagesQueryResult["status"];
  messages: MyUIMessage[] | undefined;
}

const CurrentChatContext = createContext<ChatContextValue | null>(null);

/** Provides the current chat document and paginated messages. */
export function CurrentChatProvider({
  chatId,
  children,
}: PropsWithChildren<{ chatId: Id<"chats"> }>) {
  const chat = useQuery(api.chats.queries.getChat, {
    chatId,
  });
  const { results, status, loadMore } = usePaginatedQuery(
    api.chats.queries.loadMessagesPage,
    { chatId },
    { initialNumItems: CHAT_MESSAGES_PAGE_SIZE }
  );

  const messages = useMemo(() => {
    if (status === "LoadingFirstPage" && results.length === 0) {
      return;
    }

    return mapDBMessagesToUIMessages([...results].reverse());
  }, [results, status]);
  const value = useMemo(
    () => ({
      chat,
      loadMoreMessages: loadMore,
      messages,
      messageStatus: status,
    }),
    [chat, loadMore, messages, status]
  );

  return (
    <CurrentChatContext.Provider value={value}>
      {children}
    </CurrentChatContext.Provider>
  );
}

/** Reads one selected slice of the current chat context. */
export function useCurrentChat<T>(selector: (state: ChatContextValue) => T) {
  const context = useContextSelector(CurrentChatContext, (value) => value);
  if (!context) {
    throw new Error("useCurrentChat must be used within CurrentChatProvider");
  }
  return selector(context);
}
