// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import type { QuranTranslationDocument } from "@nakafa/aksara-contracts/quran/notes";
import { loadLocaleMessages } from "@repo/internationalization/src/messages";
import { Effect, Option } from "effect";
import { createTranslator, type Locale } from "next-intl";
import { BASE_URL } from "@/lib/llms/constants";
import {
  classifyQuranLlmsRoute,
  getQuranLlmsText,
  readQuranLlmsInventory,
  readQuranLlmsPageEntries,
} from "@/lib/llms/quran";

const publicationMocks = vi.hoisted(() => ({
  readPublishedQuranCatalog: vi.fn(),
  readPublishedQuranMarkdown: vi.fn(),
}));
const BISMILLAH = "بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ";
/** Builds the real locale translator used by the server mock. */
const createHolyTranslator = Effect.fn("test.createHolyTranslator")(function* (
  locale: Locale
) {
  const messages = yield* Effect.promise(() => loadLocaleMessages(locale));
  return createTranslator({ locale, messages, namespace: "Holy" });
});

vi.mock("@/lib/content/quran/publication", () => publicationMocks);

beforeEach(() => {
  publicationMocks.readPublishedQuranCatalog.mockReset();
  publicationMocks.readPublishedQuranMarkdown.mockReset();
  publicationMocks.readPublishedQuranCatalog.mockReturnValue(
    Effect.succeed({ surahs: [surahMetadata(1), surahMetadata(2)] })
  );
  publicationMocks.readPublishedQuranMarkdown.mockImplementation(
    (locale: Locale, surahNumber: number, verseLimit?: number) =>
      Effect.succeed(surahMarkdown(locale, surahNumber, verseLimit))
  );
});

describe("quran llms text", () => {
  it("classifies canonical Quran routes without reading publication data", () => {
    expect(classifyQuranLlmsRoute("quran")).toEqual(
      Option.some({ kind: "index" })
    );
    expect(classifyQuranLlmsRoute("quran/1")).toEqual(
      Option.some({ kind: "surah", surahNumber: 1 })
    );
    expect(classifyQuranLlmsRoute("quran/114")).toEqual(
      Option.some({ kind: "surah", surahNumber: 114 })
    );

    for (const cleanSlug of [
      "articles/politics",
      "quran/",
      "quran/0",
      "quran/01",
      "quran/1.5",
      "quran/115",
      "quran/Infinity",
      "quran/NaN",
      "quran/not-a-number",
      "quran/1/extra",
    ]) {
      expect(classifyQuranLlmsRoute(cleanSlug)).toEqual(Option.none());
    }

    expect(publicationMocks.readPublishedQuranCatalog).not.toHaveBeenCalled();
    expect(publicationMocks.readPublishedQuranMarkdown).not.toHaveBeenCalled();
  });

  it.effect(
    "returns null for non-Quran and malformed Quran markdown routes",
    () =>
      Effect.gen(function* () {
        for (const cleanSlug of [
          "articles/politics/dynastic-politics-asian-values",
          "quran-afdocs-nonexistent-8f3a",
          "quran/1/extra",
          "quran/01",
          "quran/not-a-number",
          "quran/999",
        ]) {
          expect(
            yield* getQuranLlmsText({ cleanSlug, locale: "en" })
          ).toBeNull();
        }
      })
  );

  it.effect("builds Quran index and surah markdown from signed fields", () =>
    Effect.gen(function* () {
      const indexText = yield* getQuranLlmsText({
        cleanSlug: "quran",
        locale: "en",
      });
      const indonesianIndexText = yield* getQuranLlmsText({
        cleanSlug: "quran",
        locale: "id",
      });
      const firstSurahText = yield* getQuranLlmsText({
        cleanSlug: "quran/1",
        locale: "en",
      });

      expect(indexText?.startsWith("# Quran")).toBe(true);
      expect(indexText).toContain("## 1. Al-Fatihah");
      expect(indonesianIndexText).toContain("**Makna nama:** Pembuka");
      expect(firstSurahText?.startsWith("# Al-Fatihah")).toBe(true);
      expect(firstSurahText).toContain("### Verses");
      expect(firstSurahText).toContain("Technical English Tafsir notice.");
      expect(firstSurahText).toContain(
        "[Technical English Tafsir link.](https://example.test/tafsir/en/read)"
      );
      expect(firstSurahText).toContain("#### Verse 1");
      expect(firstSurahText).toContain("**Translation:** Translation 1.");
      expect(firstSurahText).toContain(
        "**Translation notes:**\n- **1.** Source note."
      );
      expect(firstSurahText).toContain("Technical Arabic source notice.");
      expect(firstSurahText).toContain("Technical Publisher · v1.0.0");
      expect(firstSurahText).not.toContain("Transliteration");
      expect(firstSurahText).not.toContain("Pre-Bismillah");
      expect(publicationMocks.readPublishedQuranCatalog).toHaveBeenCalledTimes(
        2
      );
      expect(publicationMocks.readPublishedQuranMarkdown).toHaveBeenCalledWith(
        "en",
        1,
        80
      );
    })
  );

  it.effect("uses the visible page copy for every supported locale", () =>
    Effect.gen(function* () {
      for (const locale of ["en", "id", "de"] as const) {
        const t = yield* createHolyTranslator(locale);
        const text = yield* getQuranLlmsText({
          cleanSlug: "quran/1",
          locale,
        });
        const tafsirAccess = tafsirAccessFor(locale);

        expect(text).toContain(tafsirAccess.notice);
        expect(text).toContain(
          `**${t("meaning")}:** ${surahMeanings[1][locale]}`
        );
        expect(text).toContain(
          `[${tafsirAccess.source.label}](${tafsirAccess.source.sourceUrl})`
        );
        expect(text).toContain(
          `**${t("translation-notes")}:**\n- **1.** Source note.`
        );
        expect(text).toContain(`### ${t("verses")}`);
        expect(text).toContain(`#### ${t("verse")} 1`);
        expect(text).toContain(`**${t("translation")}:**`);
        expect(text).toContain(
          `**${t("revelation")}:** ${t("revelation-place", {
            place: "Meccan",
          })}`
        );
        expect(text).toContain(`**${t("number-of-verses")}:**`);
      }
    })
  );

  it.effect("bounds long signed surah markdown to eighty verses", () =>
    Effect.gen(function* () {
      const t = yield* createHolyTranslator("id");
      const secondSurahText = yield* getQuranLlmsText({
        cleanSlug: "quran/2",
        locale: "id",
      });
      if (secondSurahText === null) {
        expect.fail("Expected signed Al-Baqarah Markdown.");
      }

      expect(secondSurahText).toContain("## Al-Baqarah");
      expect(secondSurahText).toContain(
        `**${t("revelation")}:** ${t("revelation-place", {
          place: "Meccan",
        })}`
      );
      expect(secondSurahText).toContain(`#### ${t("verse")} 80`);
      expect(secondSurahText).not.toContain(`#### ${t("verse")} 81`);
      expect(secondSurahText).toContain(BISMILLAH);
      expect(secondSurahText).toContain(
        `**${t("translation")}:** Dengan nama Allah Yang Maha Pengasih.`
      );
      expect(secondSurahText).toContain("- **7.** Catatan Bismillah.");
      expect(secondSurahText).toContain("الٓمٓ");
      expect(secondSurahText.indexOf(BISMILLAH)).toBeLessThan(
        secondSurahText.indexOf(`#### ${t("verse")} 1`)
      );
      expect(secondSurahText.split(BISMILLAH)).toHaveLength(2);
      expect(secondSurahText).toContain(
        t("markdown-limit", { numberOfVerses: 82, toVerse: 80 })
      );
    })
  );

  it.effect(
    "builds the bounded Quran index inventory from signed metadata",
    () =>
      Effect.gen(function* () {
        expect(yield* readQuranLlmsInventory()).toEqual({
          pageCount: 1,
          routeCount: 2,
        });
        for (const locale of ["en", "id", "de"] as const) {
          expect(yield* readQuranLlmsPageEntries(locale, 0)).toEqual([
            {
              description: surahMeanings[1][locale],
              href: `${BASE_URL}/${locale}/quran/1.md`,
              route: "/quran/1",
              section: "quran",
              segments: ["quran", "1"],
              title: "Al-Fatihah",
            },
            {
              description: surahMeanings[2][locale],
              href: `${BASE_URL}/${locale}/quran/2.md`,
              route: "/quran/2",
              section: "quran",
              segments: ["quran", "2"],
              title: "Al-Baqarah",
            },
          ]);
        }
      })
  );

  it.effect("rejects nonexistent signed Quran partitions", () =>
    Effect.gen(function* () {
      expect(yield* readQuranLlmsPageEntries("en", 1)).toBeNull();

      publicationMocks.readPublishedQuranCatalog.mockReturnValueOnce(
        Effect.succeed({ surahs: [] })
      );
      expect(yield* readQuranLlmsInventory()).toEqual({
        pageCount: 0,
        routeCount: 0,
      });

      publicationMocks.readPublishedQuranCatalog.mockReturnValueOnce(
        Effect.succeed({ surahs: [] })
      );
      expect(yield* readQuranLlmsPageEntries("en", 0)).toBeNull();
    })
  );
});

const surahMeanings = {
  1: { de: "Die Eröffnende", en: "The Opening", id: "Pembuka" },
  2: { de: "Die Kuh", en: "The Cow", id: "Sapi" },
} as const;

/** Builds source-authenticated Quran metadata for tests. */
function surahMetadata(number: number) {
  return {
    kind: "quran-surah",
    name: {
      arabic: number === 1 ? "الفاتحة" : "البقرة",
      meaning: number === 1 ? surahMeanings[1] : surahMeanings[2],
      transliteration: number === 1 ? "Al-Fatihah" : "Al-Baqarah",
    },
    number,
    numberOfVerses: number === 1 ? 1 : 82,
    revelation: { order: number, place: "Meccan" },
  };
}

/** Builds one signed Quran projection for markdown rendering checks. */
function surahMarkdown(locale: Locale, number: number, verseLimit?: number) {
  const numberOfVerses = number === 1 ? 1 : 82;
  const toVerse = Math.min(verseLimit ?? numberOfVerses, numberOfVerses);
  const metadata = surahMetadata(number);
  return {
    appLocale: locale,
    preBismillah:
      number === 1
        ? null
        : {
            arabic: BISMILLAH,
            translation: bismillahTranslation(locale),
          },
    sources: {
      arabic: {
        label: "Technical Arabic source.",
        notice: "Technical Arabic source notice.",
        publisher: "Technical Publisher",
        sourceUrl: "https://example.test/quran/arabic",
        version: "v1.0.0",
      },
      translation: {
        label: `Technical ${locale} translation source.`,
        notice: `Technical ${locale} translation source notice.`,
        publisher: "Technical Publisher",
        sourceUrl: `https://example.test/quran/translation/${locale}`,
        version: "v1.0.0",
      },
    },
    surah: {
      ...metadata,
      name: {
        meaning: metadata.name.meaning,
        transliteration: metadata.name.transliteration,
      },
    },
    tafsirAccess: tafsirAccessFor(locale),
    toVerse,
    verses: Array.from({ length: toVerse }, (_, index) =>
      verseFixture(number, index + 1)
    ),
  };
}

/** Builds one signed locale Tafsir access fixture for markdown checks. */
function tafsirAccessFor(locale: Locale) {
  if (locale === "id") {
    return {
      appLocale: locale,
      kind: "embedded",
      notice: "Catatan teknis tafsir Indonesia.",
      source: {
        label: "Technical Indonesian Tafsir source.",
        sourceUrl: "https://example.test/tafsir/id/read",
        updateUrl: "https://example.test/tafsir/id/updates",
      },
    };
  }
  return {
    appLocale: locale,
    kind: "external",
    notice:
      locale === "en"
        ? "Technical English Tafsir notice."
        : "Technischer deutscher Tafsirhinweis.",
    source: {
      label:
        locale === "en"
          ? "Technical English Tafsir link."
          : "Technischer deutscher Tafsirlink.",
      sourceUrl: `https://example.test/tafsir/${locale}/read`,
      updateUrl: `https://example.test/tafsir/${locale}/updates`,
    },
  };
}

/** Builds one exact locale-specific Quran markdown verse. */
function verseFixture(surahNumber: number, number: number) {
  const notes =
    number === 1
      ? [{ number: 1, referenceOffset: 12, text: "Source note." }]
      : [];
  const segments: QuranTranslationDocument["segments"] =
    number === 1
      ? [
          { kind: "text", offset: 0, value: "Translation " },
          { kind: "note", number: 1, offset: 12 },
          { kind: "text", offset: 15, value: "." },
        ]
      : [{ kind: "text", offset: 0, value: `Translation ${number}.` }];
  return {
    arabic: arabicVerse(surahNumber, number),
    number: { inSurah: number },
    translation: { notes, segments },
  };
}

/** Returns one reviewed technical Bismillah translation for the test locale. */
function bismillahTranslation(locale: Locale): QuranTranslationDocument {
  if (locale === "en") {
    return {
      notes: [],
      segments: [
        {
          kind: "text",
          offset: 0,
          value: "In the name of Allah, the Most Compassionate.",
        },
      ],
    };
  }
  if (locale === "de") {
    return {
      notes: [],
      segments: [
        {
          kind: "text",
          offset: 0,
          value: "Im Namen Allahs, des Allerbarmers.",
        },
      ],
    };
  }
  return {
    notes: [{ number: 7, referenceOffset: 41, text: "Catatan Bismillah." }],
    segments: [
      {
        kind: "text",
        offset: 0,
        value: "Dengan nama Allah Yang Maha Pengasih.",
      },
      { kind: "note", number: 7, offset: 41 },
    ],
  };
}

/** Preserves the distinct Al-Fatihah and Al-Baqarah opening verse fixtures. */
function arabicVerse(surahNumber: number, number: number) {
  if (number !== 1) {
    return `آية ${number}`;
  }
  return surahNumber === 2 ? "الٓمٓ" : BISMILLAH;
}
