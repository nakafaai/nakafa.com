"use client";

import { createContext, type MouseEventHandler, use } from "react";

/** Builds the value the tafsir triggers and drawer share: trigger state and the selection handler. */
export function buildQuranInterpretationValue({
  isControllerActive,
  isPending,
  pendingVerseNumber,
  selectInterpretation,
}: {
  isControllerActive: boolean;
  isPending: boolean;
  pendingVerseNumber: number | null;
  selectInterpretation: MouseEventHandler<HTMLButtonElement>;
}) {
  return {
    isActive: isControllerActive,
    pendingVerseNumber: isPending ? pendingVerseNumber : null,
    selectInterpretation,
  };
}

type QuranInterpretationContextValue = ReturnType<
  typeof buildQuranInterpretationValue
>;

export const QuranInterpretationContext =
  createContext<QuranInterpretationContextValue | null>(null);

/** Reads whether one tafsir trigger is inactive, idle, or loading. */
export function useQuranInterpretationState(verseNumber: number) {
  const context = use(QuranInterpretationContext);
  if (!context) {
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
  if (!context) {
    throw new Error(
      "Quran tafsir button must be rendered within QuranInterpretationControls."
    );
  }

  return context.selectInterpretation;
}
