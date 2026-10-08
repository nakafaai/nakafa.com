"use client";

import { Schema } from "effect";
import { createContext, type MouseEventHandler, use } from "react";

const QuranInterpretationStateSchema = Schema.Struct({
  isActive: Schema.Boolean,
  pendingVerseNumber: Schema.NullOr(Schema.Finite),
});

type QuranInterpretationState = typeof QuranInterpretationStateSchema.Type;

type SelectQuranInterpretation = MouseEventHandler<HTMLButtonElement>;

export const QuranInterpretationContext =
  createContext<QuranInterpretationState | null>(null);

export const QuranInterpretationSelectionContext =
  createContext<SelectQuranInterpretation | null>(null);

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
  const selectInterpretation = use(QuranInterpretationSelectionContext);
  if (!selectInterpretation) {
    throw new Error(
      "Quran tafsir button must be rendered within QuranInterpretationControls."
    );
  }

  return selectInterpretation;
}
