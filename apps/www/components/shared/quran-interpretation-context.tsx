"use client";

import { createContext, useContextSelector } from "use-context-selector";

interface QuranInterpretationState {
  isPending: boolean;
  pendingVerseNumber: number | null;
}

const missingQuranInterpretationContext = Symbol(
  "missing-quran-interpretation-context"
);

export const QuranInterpretationContext =
  createContext<QuranInterpretationState | null>(null);

/** Reads whether one verse owns the current tafsir request. */
export function useQuranInterpretationLoading(verseNumber: number) {
  const isLoading = useContextSelector(
    QuranInterpretationContext,
    (context) => {
      if (!context) {
        return missingQuranInterpretationContext;
      }

      return context.isPending && context.pendingVerseNumber === verseNumber;
    }
  );

  if (isLoading === missingQuranInterpretationContext) {
    throw new Error(
      "Quran tafsir button must be rendered within QuranInterpretationControls."
    );
  }

  return isLoading;
}
