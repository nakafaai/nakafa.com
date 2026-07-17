// @vitest-environment node
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getQuranLlmsText } from "@/lib/llms/quran";

const runtimeMocks = vi.hoisted(() => ({
  getRuntimeQuranSurahPage: vi.fn(),
  getRuntimeQuranSurahs: vi.fn(),
}));

vi.mock("@/lib/content/runtime/pages", () => ({
  getRuntimeQuranSurahPage: runtimeMocks.getRuntimeQuranSurahPage,
  getRuntimeQuranSurahs: runtimeMocks.getRuntimeQuranSurahs,
}));

beforeEach(() => {
  runtimeMocks.getRuntimeQuranSurahPage.mockReset();
  runtimeMocks.getRuntimeQuranSurahs.mockReset();
  runtimeMocks.getRuntimeQuranSurahs.mockReturnValue(
    Effect.succeed([surahMetadata(1), surahMetadata(2)])
  );
  runtimeMocks.getRuntimeQuranSurahPage.mockImplementation(({ surah }) =>
    Effect.succeed(surah === 1 || surah === 2 ? surahPage(surah) : null)
  );
});

describe("quran llms text", () => {
  it("returns null for non-quran and malformed quran markdown routes", async () => {
    await expect(
      Effect.runPromise(
        getQuranLlmsText({
          cleanSlug: "articles/politics/dynastic-politics-asian-values",
          locale: "en",
        })
      )
    ).resolves.toBe(null);
    await expect(
      Effect.runPromise(
        getQuranLlmsText({
          cleanSlug: "quran-afdocs-nonexistent-8f3a",
          locale: "en",
        })
      )
    ).resolves.toBe(null);
    await expect(
      Effect.runPromise(
        getQuranLlmsText({ cleanSlug: "quran/1/extra", locale: "en" })
      )
    ).resolves.toBe(null);
    await expect(
      Effect.runPromise(
        getQuranLlmsText({ cleanSlug: "quran/not-a-number", locale: "en" })
      )
    ).resolves.toBe(null);
    await expect(
      Effect.runPromise(
        getQuranLlmsText({ cleanSlug: "quran/999", locale: "en" })
      )
    ).resolves.toBe(null);
  });

  it("builds quran index and surah markdown with localized translations", async () => {
    const indexText = await Effect.runPromise(
      getQuranLlmsText({ cleanSlug: "quran", locale: "en" })
    );
    const firstSurahText = await Effect.runPromise(
      getQuranLlmsText({
        cleanSlug: "quran/1",
        locale: "en",
      })
    );

    expect(indexText).toContain("## 1. Al-Faatiha");
    expect(firstSurahText).toContain("### Pre-Bismillah");
    expect(firstSurahText).toContain("### Verses");
    expect(firstSurahText).toContain("#### Verse 1");
    expect(firstSurahText).toContain("**Translation:**");
  });

  it("builds surah markdown without pre-bismillah when the row omits it", async () => {
    const secondSurahText = await Effect.runPromise(
      getQuranLlmsText({
        cleanSlug: "quran/2",
        locale: "id",
      })
    );

    expect(secondSurahText).toContain("## Al-Baqarah");
    expect(secondSurahText).toContain("**Revelation:** Makkah");
    expect(secondSurahText).not.toContain("### Pre-Bismillah");
    expect(secondSurahText).toContain("#### Verse 80");
    expect(secondSurahText).not.toContain("#### Verse 81");
    expect(secondSurahText).toContain(
      "page-level markdown is bounded to verses 1-80"
    );
  });
});

/** Builds Quran surah metadata fixtures matching Convex runtime output. */
function surahMetadata(number: number) {
  return {
    name: {
      long: "سورة الفاتحة",
      short: "الفاتحة",
      transliteration: {
        en: number === 1 ? "Al-Faatiha" : "Al-Baqara",
        id: number === 1 ? "Al-Fatihah" : "Al-Baqarah",
      },
      translation: {
        en: number === 1 ? "The Opening" : "The Cow",
        id: number === 1 ? "Pembukaan" : "Sapi Betina",
      },
    },
    number,
    numberOfVerses: number === 1 ? 1 : 286,
    preBismillah: number === 1 ? preBismillahFixture() : null,
    revelation: {
      arab: "مكة",
      en: "Mecca",
      id: "Makkah",
    },
    sequence: number,
  };
}

/** Builds one Quran surah page fixture with verse rows. */
function surahPage(number = 1) {
  return {
    nextSurah: surahMetadata(2),
    prevSurah: number === 1 ? null : surahMetadata(1),
    surahData: {
      ...surahMetadata(number),
      verses: Array.from({ length: number === 2 ? 82 : 1 }, (_, index) =>
        verseFixture(index + 1)
      ),
    },
  };
}

/** Builds a Quran verse fixture for bounded markdown rendering checks. */
function verseFixture(number: number) {
  return {
    audio: {
      primary: `https://audio.example/${number}.mp3`,
      secondary: [],
    },
    meta: {
      hizbQuarter: 1,
      juz: 1,
      manzil: 1,
      page: 1,
      ruku: 1,
      sajda: {
        obligatory: false,
        recommended: false,
      },
    },
    number: {
      inQuran: number,
      inSurah: number,
    },
    tafsir: {
      id: {
        short: "Tafsir pendek.",
      },
    },
    text: {
      arab: "بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ",
      transliteration: {
        en: "Bismillahirrahmanirrahim",
      },
    },
    translation: {
      en: `Translation ${number}.`,
      id: `Terjemahan ${number}.`,
    },
  };
}

/** Builds a pre-bismillah fixture for markdown rendering checks. */
function preBismillahFixture() {
  return {
    audio: {
      primary: "https://audio.example/pre.mp3",
      secondary: [],
    },
    text: {
      arab: "بِسْمِ اللّٰهِ",
      transliteration: {
        en: "Bismillah",
      },
    },
    translation: {
      en: "In the name of Allah.",
      id: "Dengan nama Allah.",
    },
  };
}
