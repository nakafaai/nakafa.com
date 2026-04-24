"use client";

import type { MyUIMessage } from "@repo/ai/types/message";
import { type PropsWithChildren, useMemo } from "react";
import { createContext, useContextSelector } from "use-context-selector";

interface MessageContextValue {
  message: MyUIMessage;
}

const MessageContext = createContext<MessageContextValue | null>(null);

/** Provides one AI message to message-part components. */
export function MessageProvider({
  message,
  children,
}: PropsWithChildren<{ message: MyUIMessage }>) {
  const value = useMemo(() => ({ message }), [message]);

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
