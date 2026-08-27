import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import {
  QuranChunkRowSchema,
  QuranSearchRowSchema,
} from "@nakafa/aksara-contracts/quran/snapshot/row";
import { QuranSurahRowSchema } from "@nakafa/aksara-contracts/quran/spec";
import {
  getSurahName,
  readNakafaQuranReference,
  readQuranMarkdown,
} from "@repo/backend/client/nakafa/quran";
import { api } from "@repo/backend/convex/_generated/api";
import {
  encodeTestQuranRow,
  makeQuranLocaleSources,
  makeQuranTafsirProjection,
} from "@repo/backend/test/quran/rows";
import { toRuntimeQueryError } from "@repo/backend/test/runtime-query";
import { NakafaAgentInputError } from "@repo/contents/_lib/agent/errors";
import { readNakafaContentRefFixture } from "@repo/contents/_lib/agent/fixture";
import { beforeEach, describe, expect, it } from "@repo/testing/effect";
import { type FunctionReference, getFunctionName } from "convex/server";
import { Effect, Option, Schema } from "effect";
import { vi } from "vitest";

const runtimeMocks = vi.hoisted(() => ({
  runtimeQuery: vi.fn(),
}));
vi.mock("@repo/backend/client/runtime", () => ({
  readConvexRuntimeQuery: (url: string, query: unknown, args: unknown) =>
    Effect.tryPromise({
      catch: toRuntimeQueryError,
      try: () => runtimeMocks.runtimeQuery(url, query, args),
    }),
}));
const convexUrl = "https://example.convex.cloud";
const source = {
  activeManifestHash: `sha256:${"a".repeat(64)}`,
  activeReleaseId: "quran-release",
  managed: true,
  snapshotId: Sha256HashSchema.make(`sha256:${"b".repeat(64)}`),
  sourceOrigin: { kind: "git" as const, sha: "c".repeat(40) },
  sourceRevision: "c".repeat(40),
};
beforeEach(() => {
  runtimeMocks.runtimeQuery.mockReset();
  runtimeMocks.runtimeQuery.mockImplementation(readRuntimeFixture);
});
describe("Quran Nakafa reader", () => {
  it.live(
    "reads signed Quran references and includes published Indonesian tafsir",
    () =>
      Effect.gen(function* () {
        const reference = yield* readNakafaQuranReference(convexUrl, {
          from_verse: 1,
          include_tafsir: true,
          locale: "id",
          surah: 1,
          to_verse: 1,
        });
        expect(Option.getOrUndefined(reference)?.verses[0]?.tafsir).toBe(
          "Tafsir lengkap."
        );
        expect(Option.getOrUndefined(reference)?.name).toBe("Al-Fatihah");
        expect(Option.getOrUndefined(reference)?.verses[0]).toMatchObject({
          translation: {
            notes: [expect.objectContaining({ number: 4 })],
            segments: [
              expect.objectContaining({ kind: "text" }),
              expect.objectContaining({ kind: "note", number: 4 }),
            ],
          },
        });
      })
  );
  it.live("does not invent tafsir for a locale without published tafsir", () =>
    Effect.gen(function* () {
      const reference = yield* readNakafaQuranReference(convexUrl, {
        from_verse: 1,
        include_tafsir: true,
        locale: "en",
        surah: 1,
      });
      expect(
        Option.getOrUndefined(reference)?.verses[0]?.tafsir
      ).toBeUndefined();
    })
  );
  it.live("reads semantic notes and exact locale source access", () =>
    Effect.gen(function* () {
      const reference = yield* readNakafaQuranReference(convexUrl, {
        from_verse: 1,
        include_tafsir: true,
        locale: "id",
        surah: 1,
      });
      const value = Option.getOrUndefined(reference);

      expect(value?.meaning).toBeNull();
      expect(value?.sources).toMatchObject({
        arabic: { id: "tanzil-text" },
        translation: { id: "quranenc-indonesian", locale: "id" },
      });
      expect(value?.tafsir_access).toMatchObject({
        kind: "embedded",
        locale: "id",
        source: { id: "quranenc-tafsir" },
      });
      expect(value?.verses[0]?.translation).toEqual({
        notes: [
          {
            number: 4,
            referenceOffset: 18,
            text: "Catatan terjemahan Indonesia.",
          },
        ],
        segments: [
          { kind: "text", offset: 0, value: "Dengan nama Allah." },
          { kind: "note", number: 4, offset: 18 },
        ],
      });
    })
  );
  it.live("reads the reviewed German Quran translation", () =>
    Effect.gen(function* () {
      const reference = yield* readNakafaQuranReference(convexUrl, {
        from_verse: 1,
        locale: "de",
        surah: 1,
      });
      expect(
        Option.getOrUndefined(reference)?.verses[0]?.translation.segments
      ).toEqual([{ kind: "text", offset: 0, value: "Im Namen Allahs." }]);
    })
  );
  it.live("maps malformed reference input to the agent input error", () =>
    Effect.gen(function* () {
      const invalid = yield* Effect.result(
        readNakafaQuranReference(convexUrl, { surah: "one" })
      );
      expect(invalid._tag).toBe("Failure");
      if (invalid._tag === "Failure") {
        expect(invalid.failure).toBeInstanceOf(NakafaAgentInputError);
      }
    })
  );
  it.live(
    "renders full signed surah markdown without blocked legacy fields",
    () =>
      Effect.gen(function* () {
        const markdown = yield* readQuranMarkdown(
          convexUrl,
          readNakafaContentRefFixture("id", "quran/1", "quran")
        );
        expect(Option.getOrUndefined(markdown)?.title).toBe("Al-Fatihah");
        expect(Option.getOrUndefined(markdown)?.description).toBe("Al-Fatihah");
        expect(Option.getOrUndefined(markdown)?.text).toContain("## Verses");
        expect(Option.getOrUndefined(markdown)?.text).toContain(
          "Dengan nama Allah."
        );
        expect(Option.getOrUndefined(markdown)?.text).not.toContain(
          "Transliteration"
        );
      })
  );
  it.live("rejects non-Quran routes and reads source names directly", () =>
    Effect.gen(function* () {
      const missing = yield* readQuranMarkdown(
        convexUrl,
        readNakafaContentRefFixture(
          "en",
          "articles/politics/example",
          "articles"
        )
      );
      expect(Option.isNone(missing)).toBe(true);
      expect(getSurahName(surahRow())).toBe("Al-Fatihah");
    })
  );
});
/** Routes generated Convex query refs to signed Quran fixtures. */
function readRuntimeFixture(
  _convexUrl: string,
  query: FunctionReference<"query">,
  args: Record<string, unknown>
) {
  if (
    getFunctionName(query) === getFunctionName(api.contentRelease.quran.passage)
  ) {
    return Promise.resolve(referenceResult(args));
  }
  if (
    getFunctionName(query) === getFunctionName(api.contentRelease.quran.prose)
  ) {
    return Promise.resolve(markdownResult(args));
  }
  return Promise.reject(new Error("Unhandled Quran query fixture."));
}
/** Builds one signed reference response around a bounded chunk. */
function referenceResult(args: Record<string, unknown>) {
  const appLocale = readFixtureLocale(args.appLocale);
  return {
    ...source,
    chunkJson: [encodeTestQuranRow(source.snapshotId, chunkRow())],
    fromVerse: 1,
    preBismillah: null,
    searchJson: encodeTestQuranRow(source.snapshotId, searchRow(appLocale)),
    sources: makeQuranLocaleSources(appLocale),
    surahJson: encodeTestQuranRow(source.snapshotId, surahRow()),
    tafsirAccess: makeQuranTafsirProjection(appLocale),
    toVerse: 1,
  };
}
/** Builds one app-locale signed markdown response. */
function markdownResult(args: Record<string, unknown>) {
  const appLocale = readFixtureLocale(args.appLocale);
  return {
    ...source,
    appLocale,
    preBismillah: null,
    sources: makeQuranLocaleSources(appLocale),
    surah: {
      name: {
        meaning: appLocale === "en" ? "The Opening" : null,
        transliteration: "Al-Fatihah",
      },
      number: 1,
      numberOfVerses: 1,
      revelation: { place: "Meccan" },
    },
    tafsirAccess: makeQuranTafsirProjection(appLocale),
    toVerse: 1,
    verses: [
      {
        arabic: "بِسْمِ اللّٰهِ",
        number: { inSurah: 1 },
        translation: translationDocument(appLocale),
      },
    ],
  };
}

/** Builds the semantic translation document expected by canonical Markdown. */
function translationDocument(appLocale: ActiveAppLocaleCode) {
  if (appLocale === "id") {
    return {
      notes: [
        {
          number: 4,
          referenceOffset: 18,
          text: "Catatan terjemahan Indonesia.",
        },
      ],
      segments: [
        { kind: "text" as const, offset: 0, value: "Dengan nama Allah." },
        { kind: "note" as const, number: 4, offset: 18 },
      ],
    };
  }
  return {
    notes: [],
    segments: [
      {
        kind: "text" as const,
        offset: 0,
        value:
          appLocale === "de" ? "Im Namen Allahs." : "In the name of Allah.",
      },
    ],
  };
}
/** Builds one exact signed Quran surah row. */
function surahRow(number = 1) {
  return Schema.decodeSync(QuranSurahRowSchema)({
    kind: "quran-surah",
    name: {
      arabic: "الفاتحة",
      meaning: { appLocale: "en", text: "The Opening" },
      transliteration: "Al-Fatihah",
    },
    number,
    numberOfVerses: 1,
    revelation: { order: 5, place: "Meccan" },
  });
}
/** Builds one exact signed Quran chunk row. */
function chunkRow() {
  return Schema.decodeSync(QuranChunkRowSchema)({
    firstQuranNumber: 1,
    firstVerse: 1,
    kind: "quran-chunk",
    lastVerse: 1,
    surahNumber: 1,
    verses: [
      {
        meta: {
          hizbQuarter: 1,
          juz: 1,
          manzil: 1,
          page: 1,
          ruku: 1,
          sajda: null,
        },
        number: { inQuran: 1, inSurah: 1 },
        tafsir: [
          {
            appLocale: "id",
            footnotes: null,
            text: "Tafsir lengkap.",
          },
        ],
        text: { arabic: "بِسْمِ اللّٰهِ" },
        translations: [
          {
            appLocale: "en",
            value: { footnotes: "", text: "In the name of Allah." },
          },
          {
            appLocale: "id",
            value: {
              footnotes: "[4] Catatan terjemahan Indonesia.",
              text: "Dengan nama Allah.[4]",
            },
          },
          {
            appLocale: "de",
            value: { footnotes: "", text: "Im Namen Allahs." },
          },
        ],
      },
    ],
  });
}
/** Builds one app-locale signed Quran search row. */
function searchRow(appLocale: ActiveAppLocaleCode) {
  return Schema.decodeSync(QuranSearchRowSchema)({
    appLocale,
    graph: {
      alignmentId: `alignment:quran:surah:1:${appLocale}`,
      assetId: `asset:quran:surah:1:${appLocale}`,
      conceptId: "concept:quran:surah:1",
      learningObjectId: "lo:quran-surah:1",
      lensId: "lens:quran",
    },
    kind: "quran-search",
    route: "quran/1",
    surahNumber: 1,
    text: "Al-Fatihah",
    title: "1. Al-Fatihah",
  });
}

/** Narrows one runtime fixture request to the contract-owned active locales. */
function readFixtureLocale(value: unknown): ActiveAppLocaleCode {
  if (value === "id" || value === "de") {
    return value;
  }
  return "en";
}
