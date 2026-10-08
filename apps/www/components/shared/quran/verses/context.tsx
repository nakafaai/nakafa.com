"use client";

import type { QuranViewTafsirAccess } from "@repo/backend/client/quran/view";
import { createContext, type ReactNode, use } from "react";

/** Props of the verse provider: one surah's Tafsir access and verse labels. */
interface QuranVersesProviderProps {
  readonly children: ReactNode;
  readonly interpretationLabel: string;
  readonly tafsirAccess: QuranViewTafsirAccess;
  readonly translationNotesLabel: string;
}

type QuranVersesValue = Pick<
  QuranVersesProviderProps,
  "interpretationLabel" | "tafsirAccess" | "translationNotesLabel"
>;

const QuranVersesContext = createContext<QuranVersesValue | null>(null);

/** Shares a surah's Tafsir access and verse labels with every verse. */
export function QuranVersesProvider({
  children,
  interpretationLabel,
  tafsirAccess,
  translationNotesLabel,
}: QuranVersesProviderProps) {
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
