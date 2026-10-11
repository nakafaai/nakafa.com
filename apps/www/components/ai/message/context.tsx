"use client";

import type { NinaMessage } from "@repo/backend/confect/nina/schema";
import { createContext, type PropsWithChildren, use } from "react";

/**
 * Props of the message provider: one AI message, the turn it displays, and
 * whether it is the newest row of the transcript.
 */
interface MessageProviderProps {
  last: boolean;
  message: NinaMessage;
  turn?: NinaMessage["metadata"];
}

type MessageContextValue = Pick<
  MessageProviderProps,
  "last" | "message" | "turn"
>;

const MessageContext = createContext<MessageContextValue | null>(null);

/** Provides one AI message to message-part components. */
export function MessageProvider({
  last,
  message,
  turn,
  children,
}: PropsWithChildren<MessageProviderProps>) {
  const value = { last, message, turn: turn ?? message.metadata };

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
