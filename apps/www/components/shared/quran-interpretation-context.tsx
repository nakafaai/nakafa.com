"use client";

import { createContext, useContextSelector } from "use-context-selector";

const missingQuranInterpretationContext = Symbol(
  "missing-quran-interpretation-context"
);

export const QuranInterpretationContext = createContext<
  number | null | typeof missingQuranInterpretationContext
>(missingQuranInterpretationContext);

/** Reads whether one verse owns the current tafsir request. */
export function useQuranInterpretationLoading(verseNumber: number) {
  const isLoading = useContextSelector(
    QuranInterpretationContext,
    (context) => {
      if (context === missingQuranInterpretationContext) {
        return missingQuranInterpretationContext;
      }

      return context === verseNumber;
    }
  );

  if (isLoading === missingQuranInterpretationContext) {
    throw new Error(
      "Quran tafsir button must be rendered within QuranInterpretationControls."
    );
  }

  return isLoading;
}
