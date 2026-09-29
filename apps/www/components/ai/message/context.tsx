"use client";

import type { NinaMessage } from "@repo/backend/confect/nina/schema";
import type { PropsWithChildren } from "react";
import { createContext, useContextSelector } from "use-context-selector";

interface MessageContextValue {
  message: NinaMessage;
  turn: NinaMessage["metadata"];
}

const MessageContext = createContext<MessageContextValue | null>(null);

/** Provides one AI message to message-part components. */
export function MessageProvider({
  message,
  turn,
  children,
}: PropsWithChildren<{
  message: NinaMessage;
  turn?: NinaMessage["metadata"];
}>) {
  const value = { message, turn: turn ?? message.metadata };

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
