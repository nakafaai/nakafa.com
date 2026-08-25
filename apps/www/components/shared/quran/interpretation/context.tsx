"use client";

import type { MouseEventHandler } from "react";
import { createContext, useContextSelector } from "use-context-selector";

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
  const state = useContextSelector(QuranInterpretationContext, (context) => {
    if (context === missingQuranInterpretationContext) {
      return missingQuranInterpretationContext;
    }

    if (!context.isActive) {
      return "inactive";
    }

    if (context.pendingVerseNumber === verseNumber) {
      return "loading";
    }

    return "idle";
  });

  if (state === missingQuranInterpretationContext) {
    throw new Error(
      "Quran tafsir button must be rendered within QuranInterpretationControls."
    );
  }

  return state;
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
