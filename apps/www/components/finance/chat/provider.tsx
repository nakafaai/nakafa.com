"use client";

import type { MyUIMessage } from "@repo/ai/types/message";
import { api } from "@repo/backend/convex/_generated/api";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import type { PropsWithChildren } from "react";
import { createContext, useContextSelector } from "use-context-selector";

type Props = {
  chatId: Id<"chats">;
};

type ChatContextValue = {
  chat: Doc<"chats"> | undefined;
  messages: MyUIMessage[] | undefined;
};

const FinanceCurrentChatContext = createContext<ChatContextValue | null>(null);

export function FinanceCurrentChatProvider({
  chatId,
  children,
}: PropsWithChildren<Props>) {
  const chat = useQuery(api.chats.queries.getChat, {
    chatId,
  });
  const messages = useQuery(api.chats.queries.loadMessages, {
    chatId,
  });

  return (
    <FinanceCurrentChatContext.Provider value={{ chat, messages }}>
      {children}
    </FinanceCurrentChatContext.Provider>
  );
}

export function useFinanceCurrentChat<T>(
  selector: (state: ChatContextValue) => T
): T {
  return useContextSelector(FinanceCurrentChatContext, (context) => {
    if (!context) {
      throw new Error(
        "useFinanceCurrentChat must be used within FinanceCurrentChatProvider"
      );
    }
    return selector(context);
  });
}
