import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
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
import { ConvexRuntimeQueryError } from "@repo/backend/client/runtime";
import { api } from "@repo/backend/convex/_generated/api";
import { encodeTestQuranRow } from "@repo/backend/test/quran-rows";
import { NakafaAgentInputError } from "@repo/contents/_lib/agent/errors";
import { readNakafaContentRefFixture } from "@repo/contents/_lib/agent/fixture";
import { type FunctionReference, getFunctionName } from "convex/server";
import { Effect, Option, Schema } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
function toRuntimeQueryError(cause: unknown) {
  if (cause instanceof ConvexRuntimeQueryError) {
    return cause;
  }
  return new ConvexRuntimeQueryError({
    networkCodes: [],
    query: "test-runtime-query",
    reason: "query",
  });
}
const convexUrl = "https://example.convex.cloud";
const source = {
  activeManifestHash: `sha256:${"a".repeat(64)}`,
  activeReleaseId: "quran-release",
  managed: true,
  snapshotId: Sha256HashSchema.make(`sha256:${"b".repeat(64)}`),
  sourceRevision: "c".repeat(40),
};
beforeEach(() => {
  runtimeMocks.runtimeQuery.mockReset();
  runtimeMocks.runtimeQuery.mockImplementation(readRuntimeFixture);
});
describe("Quran Nakafa reader", () => {
  it("reads signed Quran references and includes published Indonesian tafsir", async () => {
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
      "Tafsir lengkap."
    );
    expect(Option.getOrUndefined(reference)?.name).toBe("Al-Fatihah");
  });
  it("does not invent tafsir for a locale without published tafsir", async () => {
    const reference = await Effect.runPromise(
      readNakafaQuranReference(convexUrl, {
        from_verse: 1,
        include_tafsir: true,
        locale: "en",
        surah: 1,
      })
    );
    expect(Option.getOrUndefined(reference)?.verses[0]?.tafsir).toBeUndefined();
  });
  it("maps malformed reference input to the agent input error", async () => {
    const invalid = await Effect.runPromise(
      Effect.result(readNakafaQuranReference(convexUrl, { surah: "one" }))
    );
    expect(invalid._tag).toBe("Failure");
    if (invalid._tag === "Failure") {
      expect(invalid.failure).toBeInstanceOf(NakafaAgentInputError);
    }
  });
  it("renders full signed surah markdown without blocked legacy fields", async () => {
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
    expect(Option.getOrUndefined(markdown)?.text).not.toContain(
      "Transliteration"
    );
  });
  it("rejects non-Quran routes and reads source names directly", async () => {
    const missing = await Effect.runPromise(
      readQuranMarkdown(
        convexUrl,
        readNakafaContentRefFixture(
          "en",
          "articles/politics/example",
          "articles"
        )
      )
    );
    expect(Option.isNone(missing)).toBe(true);
    expect(getSurahName(surahRow())).toBe("Al-Fatihah");
  });
});
/** Routes generated Convex query refs to signed Quran fixtures. */
function readRuntimeFixture(
  _convexUrl: string,
  query: FunctionReference<"query">,
  args: Record<string, unknown>
) {
  if (
    getFunctionName(query) ===
    getFunctionName(api.contentRelease.quran.reference)
  ) {
    return Promise.resolve(referenceResult(args));
  }
  if (
    getFunctionName(query) ===
    getFunctionName(api.contentRelease.quran.markdown)
  ) {
    return Promise.resolve(markdownResult(args));
  }
  return Promise.reject(new Error("Unhandled Quran query fixture."));
}
/** Builds one signed reference response around a bounded chunk. */
function referenceResult(args: Record<string, unknown>) {
  const appLocale = args.appLocale === "id" ? "id" : "en";
  return {
    ...source,
    chunkJson: [encodeTestQuranRow(source.snapshotId, chunkRow())],
    fromVerse: 1,
    searchJson: encodeTestQuranRow(source.snapshotId, searchRow(appLocale)),
    surahJson: encodeTestQuranRow(source.snapshotId, surahRow()),
    toVerse: 1,
  };
}
/** Builds one app-locale signed markdown response. */
function markdownResult(args: Record<string, unknown>) {
  const appLocale = args.appLocale === "id" ? "id" : "en";
  const verse = chunkRow().verses[0];
  if (!verse) {
    throw new Error("Expected one technical Quran verse.");
  }
  return {
    ...source,
    appLocale,
    surah: {
      name: {
        translation: "Pembukaan",
        transliteration: "Al-Fatihah",
      },
      number: 1,
      numberOfVerses: 1,
      revelation: { place: "Meccan" },
    },
    toVerse: 1,
    verses: [
      {
        arabic: verse.text.arabic,
        number: { inSurah: verse.number.inSurah },
        translation: verse.translations.find(
          (translation) => translation.appLocale === appLocale
        )?.value,
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
      translation: "Pembukaan",
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
            value: { footnotes: "", text: "Dengan nama Allah." },
          },
        ],
      },
    ],
  });
}
/** Builds one app-locale signed Quran search row. */
function searchRow(appLocale: "en" | "id") {
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
