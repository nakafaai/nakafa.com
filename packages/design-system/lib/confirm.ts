import type { ReactNode } from "react";
import { createContext } from "react";

/**
 * The sentence that says what the destructive action in reach does, read by `Button`. A dialog that asks before a
 * destructive action shares its own sentence, so the button that commits it carries `data-agent-confirm` with it: an
 * agent that reads the page sees the action needs a person, and is refused if it presses it, with the sentence to tell
 * them what it does. The button that only opens the dialog stays the agent's to press.
 */
export const AgentConfirmSentence = createContext<string | undefined>(
  undefined
);

/**
 * What a dialog's destructive action says to an agent that tries to press it: the dialog's own sentence, which says
 * what the action does, else its title, else `fallback`, a sentence that asks the agent to leave it to the reader. A
 * dialog therefore always marks its destructive action, whatever its words are drawn with.
 */
export function agentSentence(
  description: ReactNode,
  title: ReactNode,
  fallback: string
) {
  if (typeof description === "string") {
    return description;
  }
  return typeof title === "string" ? title : fallback;
}
