import type { NinaTurnSummary } from "@repo/backend/confect/nina/contract/turn";
import type { NinaMessage } from "@repo/backend/confect/nina/schema";
import { useRequired } from "@repo/design-system/hooks/required";
import { createContext, type PropsWithChildren } from "react";
import { LastMessageContext } from "@/components/ai/message/last";

/**
 * Props of the message provider: one AI message and the turn it displays.
 */
interface MessageProviderProps {
  message: NinaMessage;
  turn?: typeof NinaTurnSummary.Type | undefined;
}

type MessageContextValue = Pick<MessageProviderProps, "message" | "turn">;

const MessageContext = createContext<MessageContextValue | null>(null);

/** Provides one AI message to message-part components. */
export function MessageProvider({
  message,
  turn,
  children,
}: PropsWithChildren<MessageProviderProps>) {
  const value = { message, turn };

  return <MessageContext value={value}>{children}</MessageContext>;
}

/** Reads one selected slice of the current message. */
export function useMessage<T>(selector: (state: MessageContextValue) => T) {
  const context = useRequired(MessageContext, "useMessage");
  return selector(context);
}

/** Reads whether the current message is the newest row of the transcript. */
export function useLastMessage() {
  return useRequired(LastMessageContext, "useLastMessage");
}
