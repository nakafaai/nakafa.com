// @vitest-environment node
import { makeAppLocale } from "@nakafa/aksara-contracts/locale";
import type { QuranSurahRow } from "@nakafa/aksara-contracts/quran/spec";
import { describe, expect, it } from "vitest";
import { getQuranPagination, getQuranSurahName } from "@/lib/utils/pages/quran";

describe("quran page helpers", () => {
  it("builds pagination from source-authenticated surah names", () => {
    const page = surahPage();

    expect(
      getQuranPagination({
        nextSurah: page.nextSurah,
        prevSurah: page.prevSurah,
      })
    ).toEqual({
      next: {
        href: "/quran/2",
        title: "Al-Baqarah",
      },
      prev: {
        href: "",
        title: "",
      },
    });
    expect(
      getQuranPagination({
        nextSurah: null,
        prevSurah: page.nextSurah,
      })
    ).toEqual({
      next: {
        href: "",
        title: "",
      },
      prev: {
        href: "/quran/2",
        title: "Al-Baqarah",
      },
    });
    expect(getQuranSurahName(page.surahData.name)).toBe("Al-Fatihah");
  });
});

/** Builds one Quran surah page fixture matching Convex runtime output. */
function surahPage(): {
  nextSurah: QuranSurahRow;
  prevSurah: null;
  surahData: QuranSurahRow;
} {
  return {
    nextSurah: {
      kind: "quran-surah",
      name: {
        arabic: "البقرة",
        meaning: { appLocale: makeAppLocale("en"), text: "The Cow" },
        transliteration: "Al-Baqarah",
      },
      number: 2,
      numberOfVerses: 286,
      revelation: { order: 87, place: "Medinan" },
    },
    prevSurah: null,
    surahData: {
      kind: "quran-surah",
      name: {
        arabic: "الفاتحة",
        meaning: { appLocale: makeAppLocale("en"), text: "The Opening" },
        transliteration: "Al-Fatihah",
      },
      number: 1,
      numberOfVerses: 7,
      revelation: { order: 5, place: "Meccan" },
    },
  };
}
