"use client";

import type { MouseEventHandler } from "react";
import { createContext, useContextSelector } from "use-context-selector";

const missingQuranInterpretationContext = Symbol(
  "missing-quran-interpretation-context"
);

interface QuranInterpretationContextValue {
  pendingVerseNumber: number | null;
  selectInterpretation: MouseEventHandler<HTMLButtonElement>;
}

export const QuranInterpretationContext = createContext<
  QuranInterpretationContextValue | typeof missingQuranInterpretationContext
>(missingQuranInterpretationContext);

/** Reads whether one verse is loading tafsir. */
export function useQuranInterpretationLoading(verseNumber: number) {
  const isLoading = useContextSelector(
    QuranInterpretationContext,
    (context) => {
      if (context === missingQuranInterpretationContext) {
        return missingQuranInterpretationContext;
      }

      return context.pendingVerseNumber === verseNumber;
    }
  );

  if (isLoading === missingQuranInterpretationContext) {
    throw new Error(
      "Quran tafsir button must be rendered within QuranInterpretationControls."
    );
  }

  return isLoading;
}

/** Reads the shared React event handler for selecting tafsir. */
export function useQuranInterpretationSelection() {
  const selectInterpretation = useContextSelector(
    QuranInterpretationContext,
    (context) => {
      if (context === missingQuranInterpretationContext) {
        return missingQuranInterpretationContext;
      }

      return context.selectInterpretation;
    }
  );

  if (selectInterpretation === missingQuranInterpretationContext) {
    throw new Error(
      "Quran tafsir button must be rendered within QuranInterpretationControls."
    );
  }

  return selectInterpretation;
}
