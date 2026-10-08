import type { QuranSurahRow } from "@nakafa/aksara-contracts/quran/spec";
import { Schema } from "effect";

type QuranName = Pick<QuranSurahRow["name"], "transliteration">;
type QuranSurahNavigation = Pick<QuranSurahRow, "name" | "number">;
type QuranSurahMetadata = null | QuranSurahNavigation;

const QuranPaginationItemSchema = Schema.Struct({
  href: Schema.String,
  title: Schema.String,
});

const QuranPaginationSchema = Schema.Struct({
  next: QuranPaginationItemSchema,
  prev: QuranPaginationItemSchema,
});

/** Navigation data for Quran previous and next links. */
export type QuranPagination = typeof QuranPaginationSchema.Type;

/** Creates pagination data for Quran surah navigation. */
export function getQuranPagination({
  prevSurah,
  nextSurah,
}: {
  nextSurah: QuranSurahMetadata;
  prevSurah: QuranSurahMetadata;
}): QuranPagination {
  return {
    prev: getQuranPaginationItem(prevSurah),
    next: getQuranPaginationItem(nextSurah),
  };
}

/** Builds one Quran pagination link or an empty boundary item. */
function getQuranPaginationItem(surah: QuranSurahMetadata) {
  if (!surah) {
    return { href: "", title: "" };
  }

  return {
    href: `/quran/${surah.number}`,
    title: getQuranSurahName(surah.name),
  };
}

/** Returns the source-authenticated transliterated name for one Quran surah. */
export function getQuranSurahName(name: QuranName) {
  return name.transliteration;
}
