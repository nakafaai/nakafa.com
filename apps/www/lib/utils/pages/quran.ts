import type { QuranSurahRow } from "@nakafa/aksara-contracts/quran/spec";

export type QuranSurah = QuranSurahRow;
type QuranSurahMetadata = null | QuranSurahRow;

/** Navigation data for Quran previous and next links. */
export interface QuranPagination {
  next: {
    href: string;
    title: string;
  };
  prev: {
    href: string;
    title: string;
  };
}

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
export function getQuranSurahName(name: QuranSurah["name"]) {
  return name.transliteration;
}
