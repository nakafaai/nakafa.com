// @vitest-environment node
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BASE_URL } from "@/lib/llms/constants";
import {
  getQuranLlmsText,
  readQuranLlmsInventory,
  readQuranLlmsPageEntries,
} from "@/lib/llms/quran";

const publicationMocks = vi.hoisted(() => ({
  readPublishedQuranCatalog: vi.fn(),
  readPublishedQuranMarkdown: vi.fn(),
}));

vi.mock("@/lib/content/quran/publication", () => publicationMocks);

beforeEach(() => {
  publicationMocks.readPublishedQuranCatalog.mockReset();
  publicationMocks.readPublishedQuranMarkdown.mockReset();
  publicationMocks.readPublishedQuranCatalog.mockReturnValue(
    Effect.succeed({ surahs: [surahMetadata(1), surahMetadata(2)] })
  );
  publicationMocks.readPublishedQuranMarkdown.mockImplementation(
    (_locale: Locale, surahNumber: number, verseLimit?: number) =>
      Effect.succeed(surahMarkdown(surahNumber, verseLimit))
  );
});

describe("quran llms text", () => {
  it("returns null for non-Quran and malformed Quran markdown routes", async () => {
    for (const cleanSlug of [
      "articles/politics/dynastic-politics-asian-values",
      "quran-afdocs-nonexistent-8f3a",
      "quran/1/extra",
      "quran/01",
      "quran/not-a-number",
      "quran/999",
    ]) {
      await expect(
        Effect.runPromise(getQuranLlmsText({ cleanSlug, locale: "en" }))
      ).resolves.toBe(null);
    }
  });

  it("builds Quran index and surah markdown from signed fields", async () => {
    const indexText = await Effect.runPromise(
      getQuranLlmsText({ cleanSlug: "quran", locale: "en" })
    );
    const firstSurahText = await Effect.runPromise(
      getQuranLlmsText({ cleanSlug: "quran/1", locale: "en" })
    );

    expect(indexText?.startsWith("# Al-Quran")).toBe(true);
    expect(indexText).toContain("## 1. Al-Fatihah");
    expect(firstSurahText?.startsWith("# Al-Fatihah")).toBe(true);
    expect(firstSurahText).toContain("### Verses");
    expect(firstSurahText).toContain("#### Verse 1");
    expect(firstSurahText).toContain("**Translation:** Translation 1.");
    expect(firstSurahText).toContain("**Translation notes:** Source note.");
    expect(firstSurahText).not.toContain("Transliteration");
    expect(firstSurahText).not.toContain("Pre-Bismillah");
  });

  it("bounds long signed surah markdown to eighty verses", async () => {
    const secondSurahText = await Effect.runPromise(
      getQuranLlmsText({ cleanSlug: "quran/2", locale: "id" })
    );

    expect(secondSurahText).toContain("## Al-Baqarah");
    expect(secondSurahText).toContain("**Revelation:** Meccan");
    expect(secondSurahText).toContain("#### Verse 80");
    expect(secondSurahText).not.toContain("#### Verse 81");
    expect(secondSurahText).toContain(
      "page-level markdown is bounded to verses 1-80"
    );
  });

  it("builds the bounded Quran index inventory from signed metadata", async () => {
    await expect(Effect.runPromise(readQuranLlmsInventory())).resolves.toEqual({
      pageCount: 1,
      routeCount: 2,
    });
    await expect(
      Effect.runPromise(readQuranLlmsPageEntries("id", 0))
    ).resolves.toEqual([
      {
        description: "The Opening",
        href: `${BASE_URL}/id/quran/1.md`,
        route: "/quran/1",
        section: "quran",
        segments: ["quran", "1"],
        title: "Al-Fatihah",
      },
      {
        description: "The Cow",
        href: `${BASE_URL}/id/quran/2.md`,
        route: "/quran/2",
        section: "quran",
        segments: ["quran", "2"],
        title: "Al-Baqarah",
      },
    ]);
  });

  it("rejects nonexistent signed Quran partitions", async () => {
    await expect(
      Effect.runPromise(readQuranLlmsPageEntries("en", 1))
    ).resolves.toBeNull();

    publicationMocks.readPublishedQuranCatalog.mockReturnValueOnce(
      Effect.succeed({ surahs: [] })
    );
    await expect(Effect.runPromise(readQuranLlmsInventory())).resolves.toEqual({
      pageCount: 0,
      routeCount: 0,
    });

    publicationMocks.readPublishedQuranCatalog.mockReturnValueOnce(
      Effect.succeed({ surahs: [] })
    );
    await expect(
      Effect.runPromise(readQuranLlmsPageEntries("en", 0))
    ).resolves.toBeNull();
  });
});

/** Builds source-authenticated Quran metadata for tests. */
function surahMetadata(number: number) {
  return {
    kind: "quran-surah",
    name: {
      arabic: number === 1 ? "الفاتحة" : "البقرة",
      translation: number === 1 ? "The Opening" : "The Cow",
      transliteration: number === 1 ? "Al-Fatihah" : "Al-Baqarah",
    },
    number,
    numberOfVerses: number === 1 ? 1 : 82,
    revelation: { order: number, place: "Meccan" },
  };
}

/** Builds one signed Quran projection for markdown rendering checks. */
function surahMarkdown(number: number, verseLimit?: number) {
  const numberOfVerses = number === 1 ? 1 : 82;
  const toVerse = Math.min(verseLimit ?? numberOfVerses, numberOfVerses);
  return {
    locale: "en",
    surah: surahMetadata(number),
    toVerse,
    verses: Array.from({ length: toVerse }, (_, index) =>
      verseFixture(index + 1)
    ),
  };
}

/** Builds one exact locale-specific Quran markdown verse. */
function verseFixture(number: number) {
  return {
    arabic: "بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ",
    number: { inSurah: number },
    translation: {
      footnotes: number === 1 ? "Source note." : "",
      text: `Translation ${number}.`,
    },
  };
}
