// @vitest-environment node
import { describe, expect, it } from "vitest";
import { getQuranPagination, getQuranSurahName } from "@/lib/utils/pages/quran";

describe("quran page helpers", () => {
  it("builds pagination and localized display names", () => {
    const page = surahPage();

    expect(
      getQuranPagination({
        locale: "id",
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
        locale: "en",
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
        title: "Al-Baqara",
      },
    });
    expect(
      getQuranSurahName({
        locale: "id",
        name: page.surahData.name,
      })
    ).toBe("Al-Fatihah");
  });
});

/** Builds one Quran surah page fixture matching Convex runtime output. */
function surahPage() {
  return {
    nextSurah: {
      name: {
        long: "Al-Baqarah",
        short: "البقرة",
        transliteration: { en: "Al-Baqara", id: "Al-Baqarah" },
        translation: { en: "The Cow", id: "Sapi Betina" },
      },
      number: 2,
      numberOfVerses: 286,
      preBismillah: null,
      revelation: { arab: "مدنية", en: "Medinan", id: "Madaniyah" },
      sequence: 87,
    },
    prevSurah: null,
    surahData: {
      name: {
        long: "Al-Fatihah",
        short: "الفاتحة",
        transliteration: { en: "Al-Faatiha", id: "Al-Fatihah" },
        translation: { en: "The Opening", id: "Pembukaan" },
      },
      number: 1,
      numberOfVerses: 7,
      preBismillah: null,
      revelation: { arab: "مكية", en: "Meccan", id: "Makkiyah" },
      sequence: 5,
    },
  };
}
