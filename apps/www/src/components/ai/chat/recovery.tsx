import { createContext, use } from "react";

/**
 * The retry of a chat's failure card: whether a retry is waiting, and the
 * action that runs the read again. The surface that owns the read provides it,
 * and the card's retry button reads it.
 */
export const ChatRetryContext = createContext<{
  readonly isPending: boolean;
  readonly onRetry: () => void;
} | null>(null);

/** Reads the retry of the failure card around it. */
export function useChatRetry() {
  const retry = use(ChatRetryContext);
  if (retry === null) {
    throw new Error("useChatRetry must be used within ChatRetryContext");
  }
  return retry;
}
