import { useRequired } from "@repo/design-system/hooks/required";
import { createContext, type MouseEventHandler } from "react";

interface QuranInterpretationContextValue {
  isActive: boolean;
  pendingVerseNumber: number | null;
  selectInterpretation: MouseEventHandler<HTMLButtonElement>;
}

export const QuranInterpretationContext =
  createContext<QuranInterpretationContextValue | null>(null);

/** Reads whether one tafsir trigger is inactive, idle, or loading. */
export function useQuranInterpretationState(verseNumber: number) {
  const context = useRequired(
    QuranInterpretationContext,
    "useQuranInterpretationState"
  );

  if (!context.isActive) {
    return "inactive";
  }

  if (context.pendingVerseNumber === verseNumber) {
    return "loading";
  }

  return "idle";
}

/** Reads the shared React event handler for selecting tafsir. */
export function useQuranInterpretationSelection() {
  const context = useRequired(
    QuranInterpretationContext,
    "useQuranInterpretationSelection"
  );

  return context.selectInterpretation;
}
