"use client";

import { Schema } from "effect";
import { createContext, use } from "react";

/** One verse of a surah as its row of the list shows it. */
const QuranVerseRow = Schema.Struct({
  /** Whether the verse is the last one of the surah, which has no rule below it. */
  isLast: Schema.Boolean,
  /** The verse's label in the outline, the interpretation and the translation. */
  label: Schema.String,
  /** The verse's number in its surah. */
  number: Schema.Finite,
});

/** The row of the verse that renders the part of it. */
export const QuranVerseRowContext = createContext<
  typeof QuranVerseRow.Type | null
>(null);

/** Reads the row of the verse that renders the part. */
export function useQuranVerseRow() {
  const row = use(QuranVerseRowContext);
  if (row === null) {
    throw new Error("useQuranVerseRow must be used within a Quran verse");
  }
  return row;
}
