import { useRequired } from "@repo/design-system/hooks/required";
import type { PromptInputMessage } from "@repo/design-system/lib/prompt/submission";
import { createContext } from "react";

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
  return useRequired(HeldPromptContext, "useHeld");
}

/** Reads the send held for the live composer around it. */
export function useHeldPrompt() {
  return useHeld().held;
}

/** Reads whether an attach press is held for the live composer around it. */
export function useHeldAttach() {
  return useHeld().attach;
}
