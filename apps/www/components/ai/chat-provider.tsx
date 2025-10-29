"use client";

import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { PropsWithChildren } from "react";
import { createContext, useContextSelector } from "use-context-selector";

type Props = {
  chatId: Id<"chats">;
};

const ChatIdContext = createContext<Props | null>(null);

export function ChatIdProvider({ chatId, children }: PropsWithChildren<Props>) {
  return (
    <ChatIdContext.Provider value={{ chatId }}>
      {children}
    </ChatIdContext.Provider>
  );
}

export function useChatId<T>(selector: (state: Props) => T): T {
  return useContextSelector(ChatIdContext, (context) => {
    if (!context) {
      throw new Error("useChatId must be used within ChatIdProvider");
    }
    return selector(context);
  });
}
