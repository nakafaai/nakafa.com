import type { PromptInputMessage } from "@repo/design-system/lib/prompt-input/submission";
import { createContext, use } from "react";

/**
 * What a signed-in learner pressed before the live composer loaded: the send,
 * or none, and whether they pressed attach. The composer that held them
 * provides them, and the live composer admits the send and opens its file
 * picker once it mounts.
 */
export const HeldPromptContext = createContext<{
  readonly attach: boolean;
  readonly held: PromptInputMessage | null;
} | null>(null);

function useHeld() {
  const value = use(HeldPromptContext);
  if (value === null) {
    throw new Error("The held prompt must be read within HeldPromptContext");
  }
  return value;
}

/** Reads the send held for the live composer around it. */
export function useHeldPrompt() {
  return useHeld().held;
}

/** Reads whether an attach press is held for the live composer around it. */
export function useHeldAttach() {
  return useHeld().attach;
}
