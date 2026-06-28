// @vitest-environment node
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchSurahContext,
  fetchSurahMetadataContext,
  getQuranPagination,
  getQuranSurahName,
} from "@/lib/utils/pages/quran";

const runtimeMocks = vi.hoisted(() => ({
  getRuntimeQuranSurahPage: vi.fn(),
}));

vi.mock("@/lib/content/runtime/pages", () => ({
  getRuntimeQuranSurahPage: runtimeMocks.getRuntimeQuranSurahPage,
}));

beforeEach(() => {
  runtimeMocks.getRuntimeQuranSurahPage.mockReset();
  runtimeMocks.getRuntimeQuranSurahPage.mockImplementation(({ surah }) =>
    Effect.succeed(surah === 1 ? surahPage() : null)
  );
});

describe("quran page runtime helpers", () => {
  it("fetches surah context from Convex runtime rows", async () => {
    await expect(
      Effect.runPromise(fetchSurahContext({ surah: 1 }))
    ).resolves.toMatchObject({
      nextSurah: { number: 2 },
      prevSurah: null,
      surahData: { number: 1 },
    });
  });

  it("fails for missing surah context and returns null metadata context", async () => {
    await expect(
      Effect.runPromise(fetchSurahContext({ surah: 999 }))
    ).rejects.toThrow('"surah": 999');
    await expect(
      Effect.runPromise(fetchSurahMetadataContext({ surah: 999 }))
    ).resolves.toEqual({
      surahData: null,
    });
  });

  it("builds pagination and localized display names", () => {
    const page = surahPage();

    expect(
      getQuranPagination({
        nextSurah: page.nextSurah,
        prevSurah: page.prevSurah,
      })
    ).toEqual({
      next: {
        href: "/quran/2",
        title: "The Cow",
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
        title: "The Cow",
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
