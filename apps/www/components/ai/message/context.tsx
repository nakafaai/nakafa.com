"use client";

import type { NinaMessage } from "@repo/backend/confect/nina/schema";
import type { PropsWithChildren } from "react";
import { createContext, useContextSelector } from "use-context-selector";
import { useChat } from "@/components/ai/chat/context";

interface MessageContextValue {
  message: NinaMessage;
  turn: NinaMessage["metadata"];
}

const MessageContext = createContext<MessageContextValue | null>(null);

/** Provides one AI message to message-part components. */
export function MessageProvider({
  message,
  children,
}: PropsWithChildren<{ message: NinaMessage }>) {
  const latest = useChat((state) => state.turn);
  const turn = latest?.order === message.order ? latest : message.metadata;
  const value = { message, turn };

  return (
    <MessageContext.Provider value={value}>{children}</MessageContext.Provider>
  );
}

/** Reads one selected slice of the current message. */
export function useMessage<T>(selector: (state: MessageContextValue) => T) {
  return useContextSelector(MessageContext, (context) => {
    if (!context) {
      throw new Error("useMessage must be used within MessageProvider");
    }
    return selector(context);
  });
}
