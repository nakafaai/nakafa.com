"use client";

import type { QuranViewTafsirAccess } from "@repo/backend/client/quran/view";
import type { ReactNode } from "react";
import { createContext, useContextSelector } from "use-context-selector";

interface QuranVersesValue {
  readonly interpretationLabel: string;
  readonly tafsirAccess: QuranViewTafsirAccess;
  readonly translationNotesLabel: string;
}

const missingQuranVerses = Symbol("missing-quran-verses");

const QuranVersesContext = createContext<
  QuranVersesValue | typeof missingQuranVerses
>(missingQuranVerses);

/** Shares a surah's Tafsir access and verse labels with every verse. */
export function QuranVersesProvider({
  children,
  interpretationLabel,
  tafsirAccess,
  translationNotesLabel,
}: QuranVersesValue & { children: ReactNode }) {
  return (
    <QuranVersesContext.Provider
      value={{ interpretationLabel, tafsirAccess, translationNotesLabel }}
    >
      {children}
    </QuranVersesContext.Provider>
  );
}

/** Selects one of the surah's shared verse settings. */
export function useQuranVerses<T>(selector: (value: QuranVersesValue) => T) {
  const selected = useContextSelector(QuranVersesContext, (value) =>
    value === missingQuranVerses ? missingQuranVerses : selector(value)
  );
  if (selected === missingQuranVerses) {
    throw new Error("Quran verses must render within QuranVersesProvider.");
  }
  return selected;
}
