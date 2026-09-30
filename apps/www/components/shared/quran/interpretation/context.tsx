"use client";

import { createContext, type MouseEventHandler, use } from "react";

const missingQuranInterpretationContext = Symbol(
  "missing-quran-interpretation-context"
);

interface QuranInterpretationContextValue {
  isActive: boolean;
  pendingVerseNumber: number | null;
  selectInterpretation: MouseEventHandler<HTMLButtonElement>;
}

export const QuranInterpretationContext = createContext<
  QuranInterpretationContextValue | typeof missingQuranInterpretationContext
>(missingQuranInterpretationContext);

/** Reads whether one tafsir trigger is inactive, idle, or loading. */
export function useQuranInterpretationState(verseNumber: number) {
  const context = use(QuranInterpretationContext);
  if (context === missingQuranInterpretationContext) {
    throw new Error(
      "Quran tafsir button must be rendered within QuranInterpretationControls."
    );
  }

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
  const context = use(QuranInterpretationContext);
  if (context === missingQuranInterpretationContext) {
    throw new Error(
      "Quran tafsir button must be rendered within QuranInterpretationControls."
    );
  }

  return context.selectInterpretation;
}
