import { useRequired } from "@repo/design-system/hooks/required";
import { createContext } from "react";

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
  return useRequired(ChatRetryContext, "useChatRetry");
}
