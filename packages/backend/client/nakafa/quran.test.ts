import {
  getSurahName,
  readNakafaQuranReference,
  readQuranMarkdown,
} from "@repo/backend/client/nakafa/quran";
import { api } from "@repo/backend/convex/_generated/api";
import { NakafaAgentInputError } from "@repo/contents/_lib/agent/errors";
import { readNakafaContentRefFixture } from "@repo/contents/_lib/agent/fixture";
import { LocaleSchema } from "@repo/contents/_types/content";
import { type FunctionReference, getFunctionName } from "convex/server";
import { Effect, Option, Schema } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const runtimeMocks = vi.hoisted(() => ({
  fetchConvexRuntimeQuery: vi.fn(),
}));

vi.mock("@repo/backend/client/runtime", () => ({
  fetchConvexRuntimeQuery: runtimeMocks.fetchConvexRuntimeQuery,
}));

const QuranReferenceArgsSchema = Schema.Struct({
  fromVerse: Schema.Number,
  includeTafsir: Schema.Boolean,
  locale: LocaleSchema,
  surah: Schema.Number,
  toVerse: Schema.optional(Schema.Number),
});
type QuranReferenceArgs = Schema.Schema.Type<typeof QuranReferenceArgsSchema>;
const QuranSurahArgsSchema = Schema.Struct({
  surah: Schema.Number,
});

const convexUrl = "https://example.convex.cloud";

beforeEach(() => {
  runtimeMocks.fetchConvexRuntimeQuery.mockReset();
  runtimeMocks.fetchConvexRuntimeQuery.mockImplementation(readRuntimeFixture);
});

describe("Quran Nakafa reader", () => {
  it("reads Quran references and includes tafsir when requested", async () => {
    const reference = await Effect.runPromise(
      readNakafaQuranReference(convexUrl, {
        from_verse: 1,
        include_tafsir: true,
        locale: "id",
        surah: 1,
        to_verse: 1,
      })
    );

    expect(Option.getOrUndefined(reference)?.verses[0]?.tafsir).toBe(
      "Tafsir pendek."
    );
    expect(Option.getOrUndefined(reference)?.name).toBe("Al-Fatihah");
  });

  it("does not fall back to tafsir from another locale", async () => {
    const reference = await Effect.runPromise(
      readNakafaQuranReference(convexUrl, {
        from_verse: 1,
        include_tafsir: true,
        locale: "en",
        surah: 1,
        to_verse: 1,
      })
    );

    expect(Option.getOrUndefined(reference)?.verses[0]?.tafsir).toBeUndefined();
  });

  it("maps invalid references to input errors and missing rows to none", async () => {
    const invalid = await Effect.runPromise(
      Effect.either(readNakafaQuranReference(convexUrl, { surah: "one" }))
    );
    const missing = await Effect.runPromise(
      readNakafaQuranReference(convexUrl, {
        from_verse: 999,
        locale: "en",
        surah: 1,
      })
    );

    expect(invalid._tag).toBe("Left");

    if (invalid._tag === "Left") {
      expect(invalid.left).toBeInstanceOf(NakafaAgentInputError);
    }

    expect(Option.isNone(missing)).toBe(true);
  });

  it("renders full surah markdown from Quran runtime rows", async () => {
    const markdown = await Effect.runPromise(
      readQuranMarkdown(
        convexUrl,
        readNakafaContentRefFixture("id", "quran/1", "quran")
      )
    );

    expect(Option.getOrUndefined(markdown)?.title).toBe("Al-Fatihah");
    expect(Option.getOrUndefined(markdown)?.description).toBe("Pembukaan");
    expect(Option.getOrUndefined(markdown)?.text).toContain("## Verses");
    expect(Option.getOrUndefined(markdown)?.text).toContain(
      "Dengan nama Allah."
    );
  });

  it("returns none for missing surahs and localizes known names", async () => {
    const missing = await Effect.runPromise(
      readQuranMarkdown(
        convexUrl,
        readNakafaContentRefFixture("en", "quran/2", "quran")
      )
    );

    expect(Option.isNone(missing)).toBe(true);
    expect(
      getSurahName({
        locale: "en",
        surah: { name: quranSurah().name },
      })
    ).toBe("Al-Faatiha");
  });
});

/** Routes generated Convex query refs to Quran reader fixtures. */
function readRuntimeFixture(
  _convexUrl: string,
  query: FunctionReference<"query">,
  args: unknown
) {
  if (
    getFunctionName(query) ===
    getFunctionName(api.contents.queries.runtime.getQuranReference)
  ) {
    return Promise.resolve(readQuranReference(args));
  }

  if (
    getFunctionName(query) ===
    getFunctionName(api.contents.queries.runtime.getQuranSurahPage)
  ) {
    return Promise.resolve(readQuranSurahPage(args));
  }

  return Promise.reject(new Error("Unhandled Quran query fixture."));
}

/** Builds one Quran reference fixture from generated query args. */
function readQuranReference(args: unknown) {
  const input = Schema.decodeUnknownSync(QuranReferenceArgsSchema)(args);

  if (input.fromVerse === 999) {
    return null;
  }

  return {
    ...readNakafaContentRefFixture(
      input.locale,
      `quran/${input.surah}`,
      "quran"
    ),
    name: input.locale === "id" ? "Al-Fatihah" : "Al-Faatiha",
    revelation: input.locale === "id" ? "Makkah" : "Mecca",
    translation: input.locale === "id" ? "Pembukaan" : "The Opening",
    verses: [quranReferenceVerse(input)],
  };
}

/** Builds one locale-aware Quran reference verse fixture. */
function quranReferenceVerse(input: QuranReferenceArgs) {
  const verse = {
    arabic: "بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ",
    number: input.fromVerse,
    translation: "Dengan nama Allah.",
    transliteration: "Bismillahirrahmanirrahim",
  };

  if (!input.includeTafsir || input.locale !== "id") {
    return verse;
  }

  return {
    ...verse,
    tafsir: "Tafsir pendek.",
  };
}

/** Builds one Quran surah page fixture from generated query args. */
function readQuranSurahPage(args: unknown) {
  const input = Schema.decodeUnknownSync(QuranSurahArgsSchema)(args);

  if (input.surah !== 1) {
    return null;
  }

  return {
    nextSurah: null,
    prevSurah: null,
    surahData: quranSurah(),
  };
}

/** Builds one Quran surah with one verse for markdown tests. */
function quranSurah() {
  return {
    name: {
      long: "سورة الفاتحة",
      short: "الفاتحة",
      transliteration: { en: "Al-Faatiha", id: "Al-Fatihah" },
      translation: { en: "The Opening", id: "Pembukaan" },
    },
    number: 1,
    numberOfVerses: 1,
    preBismillah: null,
    revelation: { arab: "مكة", en: "Mecca", id: "Makkah" },
    sequence: 1,
    verses: [
      {
        audio: { primary: "https://audio.example/1.mp3", secondary: [] },
        meta: {
          hizbQuarter: 1,
          juz: 1,
          manzil: 1,
          page: 1,
          ruku: 1,
          sajda: { obligatory: false, recommended: false },
        },
        number: { inQuran: 1, inSurah: 1 },
        tafsir: { id: { short: "Tafsir pendek." } },
        text: {
          arab: "بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ",
          transliteration: { en: "Bismillahirrahmanirrahim" },
        },
        translation: { en: "In the name of Allah.", id: "Dengan nama Allah." },
      },
    ],
  };
}
