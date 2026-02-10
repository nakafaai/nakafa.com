"use client";

import type { MyUIMessage } from "@repo/ai/types/message";
import { api } from "@repo/backend/convex/_generated/api";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import { mapDBMessagesToUIMessages } from "@repo/backend/convex/chats/utils";
import { useQuery } from "convex/react";
import { type PropsWithChildren, useMemo } from "react";
import { createContext, useContextSelector } from "use-context-selector";

interface Props {
  chatId: Id<"chats">;
}

interface ChatContextValue {
  chat: Doc<"chats"> | undefined;
  messages: MyUIMessage[] | undefined;
}

const CurrentChatContext = createContext<ChatContextValue | null>(null);

export function CurrentChatProvider({
  chatId,
  children,
}: PropsWithChildren<Props>) {
  const chat = useQuery(api.chats.queries.getChat, {
    chatId,
  });
  const rawMessages = useQuery(api.chats.queries.loadMessages, {
    chatId,
  });

  // Transform raw DB messages to UI messages
  const messages = useMemo(
    () => (rawMessages ? mapDBMessagesToUIMessages(rawMessages) : undefined),
    [rawMessages]
  );

  return (
    <CurrentChatContext.Provider value={{ chat, messages }}>
      {children}
    </CurrentChatContext.Provider>
  );
}

export function useCurrentChat<T>(selector: (state: ChatContextValue) => T): T {
  return useContextSelector(CurrentChatContext, (context) => {
    if (!context) {
      throw new Error("useChat must be used within CurrentChatProvider");
    }
    return selector(context);
  });
}
