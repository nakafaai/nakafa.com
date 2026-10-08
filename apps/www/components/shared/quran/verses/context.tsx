"use client";

import { quranTafsirAccessValidator } from "@repo/backend/confect/contentRelease/quran/spec";
import { Schema } from "effect";
import { createContext, type ReactNode, use } from "react";

const QuranVersesValueSchema = Schema.Struct({
  interpretationLabel: Schema.String,
  tafsirAccess: quranTafsirAccessValidator,
  translationNotesLabel: Schema.String,
});
type QuranVersesValue = typeof QuranVersesValueSchema.Type;

const QuranVersesContext = createContext<QuranVersesValue | null>(null);

/** Shares a surah's Tafsir access and verse labels with every verse. */
export function QuranVersesProvider({
  children,
  interpretationLabel,
  tafsirAccess,
  translationNotesLabel,
}: QuranVersesValue & { children: ReactNode }) {
  return (
    <QuranVersesContext
      value={{ interpretationLabel, tafsirAccess, translationNotesLabel }}
    >
      {children}
    </QuranVersesContext>
  );
}

/** Selects one of the surah's shared verse settings. */
export function useQuranVerses<T>(selector: (value: QuranVersesValue) => T) {
  const value = use(QuranVersesContext);
  if (!value) {
    throw new Error("Quran verses must render within QuranVersesProvider.");
  }
  return selector(value);
}
