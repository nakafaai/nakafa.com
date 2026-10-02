"use client";

import type { NinaMessage } from "@repo/backend/confect/nina/schema";
import { createContext, type PropsWithChildren, use } from "react";

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

  return <MessageContext value={value}>{children}</MessageContext>;
}

/** Reads one selected slice of the current message. */
export function useMessage<T>(selector: (state: MessageContextValue) => T) {
  const context = use(MessageContext);
  if (!context) {
    throw new Error("useMessage must be used within MessageProvider");
  }
  return selector(context);
}
