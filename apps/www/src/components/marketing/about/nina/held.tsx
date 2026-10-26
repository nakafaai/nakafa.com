import type { PromptInputMessage } from "@repo/design-system/lib/prompt-input/submission";
import { createContext, use } from "react";

/**
 * The send that a signed-in learner pressed before the live composer loaded,
 * or none. The composer that held it provides it, and the live composer admits
 * it once it mounts.
 */
export const HeldPromptContext = createContext<{
  readonly held: PromptInputMessage | null;
} | null>(null);

/** Reads the send held for the live composer around it. */
export function useHeldPrompt() {
  const value = use(HeldPromptContext);
  if (value === null) {
    throw new Error("useHeldPrompt must be used within HeldPromptContext");
  }
  return value.held;
}
