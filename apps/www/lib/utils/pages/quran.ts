import type { api } from "@repo/backend/convex/_generated/api";
import type { Locale } from "@repo/utilities/locales";
import type { FunctionReturnType } from "convex/server";

type QuranSurahPage = NonNullable<
  FunctionReturnType<typeof api.contents.queries.runtime.getQuranSurahPage>
>;
export type QuranSurah = QuranSurahPage["surahData"];
type QuranSurahMetadata = QuranSurahPage["prevSurah"];

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
  locale,
  prevSurah,
  nextSurah,
}: {
  locale: Locale;
  nextSurah: QuranSurahMetadata;
  prevSurah: QuranSurahMetadata;
}): QuranPagination {
  return {
    prev: getQuranPaginationItem(prevSurah, locale),
    next: getQuranPaginationItem(nextSurah, locale),
  };
}

/** Builds one Quran pagination link or an empty boundary item. */
function getQuranPaginationItem(surah: QuranSurahMetadata, locale: Locale) {
  if (!surah) {
    return { href: "", title: "" };
  }

  return {
    href: `/quran/${surah.number}`,
    title: getQuranSurahName({ locale, name: surah.name }),
  };
}

/** Returns the locale-aware display name for one Quran surah. */
export function getQuranSurahName({
  locale,
  name,
}: {
  locale: Locale;
  name: QuranSurah["name"];
}) {
  return name.transliteration[locale];
}
