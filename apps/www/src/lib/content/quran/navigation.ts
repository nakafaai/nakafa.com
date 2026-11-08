import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import {
  type QuranSurahRow,
  QuranSurahRowSchema,
} from "@nakafa/aksara-contracts/quran/spec";
import { selectQuranMeaning } from "@repo/backend/content/quran/contract";
import { Array as Arr, Schema, Struct } from "effect";
import type { QuranIndexSurah } from "@/lib/content/quran/search";

type QuranName = Pick<QuranSurahRow["name"], "transliteration">;
/** Surah link fields: the number and the transliterated name the links read. */
const QuranSurahNavigationSchema = Schema.Struct({
  name: QuranSurahRowSchema.fields.name.mapFields(
    Struct.pick(["transliteration"])
  ),
  number: QuranSurahRowSchema.fields.number,
});
type QuranSurahNavigation = typeof QuranSurahNavigationSchema.Type;
type QuranSurahMetadata = null | QuranSurahNavigation;

const QuranPaginationItemSchema = Schema.Struct({
  publicPath: Schema.String,
  title: Schema.String,
});

const QuranPaginationSchema = Schema.Struct({
  next: QuranPaginationItemSchema,
  prev: QuranPaginationItemSchema,
});

/** Navigation data for Quran previous and next links. */
type QuranPagination = typeof QuranPaginationSchema.Type;

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
    return { publicPath: "", title: "" };
  }

  return {
    publicPath: `quran/${surah.number}`,
    title: getQuranSurahName(surah.name),
  };
}

/** Returns the source-authenticated transliterated name for one Quran surah. */
export function getQuranSurahName(name: QuranName) {
  return name.transliteration;
}

/**
 * The surahs of the catalog as a surah search lists them, in the page's language:
 * each one's number, its two names and the meaning of its name.
 */
export function toQuranIndexSurahs(
  surahs: readonly Pick<QuranSurahRow, "name" | "number">[],
  locale: ActiveAppLocaleCode
): (typeof QuranIndexSurah.Type)[] {
  return Arr.map(surahs, (surah) => ({
    arabic: surah.name.arabic,
    meaning: selectQuranMeaning(surah.name.meaning, locale).text,
    number: surah.number,
    title: getQuranSurahName(surah.name),
  }));
}
