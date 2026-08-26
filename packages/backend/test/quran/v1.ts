import { PublicPathSchema, type Sha256Hash } from "@nakafa/aksara-v151/ids";
import {
  ACTIVE_APP_LOCALES,
  type AppLocaleCode,
} from "@nakafa/aksara-v151/locale";
import {
  QuranChunkRowSchema,
  type QuranRowPayload,
  type QuranRuntimeVerse,
  QuranRuntimeVerseSchema,
  QuranSearchRowSchema,
} from "@nakafa/aksara-v151/quran/snapshot/row";
import { bindQuranRow } from "@nakafa/aksara-v151/quran/snapshot/row-hash";
import {
  QuranAttributionRowSchema,
  quranSourceIds,
} from "@nakafa/aksara-v151/quran/source";
import {
  type QuranSurahRow,
  QuranSurahRowSchema,
} from "@nakafa/aksara-v151/quran/spec";
import { canonicalizeContentSnapshotRow } from "@nakafa/aksara-v151/release/snapshot/data";
import { Effect, Schema } from "effect";

const testDigest = `sha256:${"1".repeat(64)}`;
type QuranChunkRow = typeof QuranChunkRowSchema.Type;
type QuranSearchRow = typeof QuranSearchRowSchema.Type;

/** Creates the complete technical attribution row required by runtime tests. */
export function makeQuranAttribution() {
  return Schema.decodeUnknownSync(QuranAttributionRowSchema)({
    activeAppLocales: ACTIVE_APP_LOCALES,
    kind: "quran-attribution",
    sources: quranSourceIds(ACTIVE_APP_LOCALES).map((id) => ({
      artifact: { byteCount: 1, digest: testDigest, fileCount: 1 },
      copy: ACTIVE_APP_LOCALES.map((appLocale) => ({
        appLocale,
        notice: `Technical attribution notice ${appLocale}`,
        title: `Technical source ${id} ${appLocale}`,
      })),
      id,
      publisher: "Nakafa protocol tests",
      retrievedAt: "2026-07-31T00:00:00Z",
      sourceUrl: `https://example.test/${id}`,
      terms: {
        artifact: { byteCount: 1, digest: testDigest, fileCount: 1 },
        url: `https://example.test/${id}/terms`,
      },
      updateUrl: `https://example.test/${id}/updates`,
      version: "technical-version",
    })),
  });
}

/** Creates one signed-contract surah metadata row for protocol tests. */
export function makeQuranSurah(
  surahNumber: number,
  numberOfVerses = 1
): QuranSurahRow {
  return QuranSurahRowSchema.make({
    kind: "quran-surah",
    name: {
      arabic: `سورة ${surahNumber}`,
      translation: `Technical meaning ${surahNumber}`,
      transliteration: `Technical Surah ${surahNumber}`,
    },
    number: surahNumber,
    numberOfVerses,
    revelation: { order: surahNumber, place: "Meccan" },
  });
}

/** Creates one exact technical verse inside a bounded runtime chunk. */
function makeQuranVerse(inQuran: number, inSurah: number): QuranRuntimeVerse {
  return Schema.decodeSync(QuranRuntimeVerseSchema)({
    meta: {
      hizbQuarter: 1,
      juz: 1,
      manzil: 1,
      page: 1,
      ruku: 1,
      sajda: null,
    },
    number: { inQuran, inSurah },
    tafsir: [
      {
        appLocale: "id",
        footnotes: null,
        text: `Tafsir teknis ${inSurah}`,
      },
    ],
    text: { arabic: `آية ${inSurah}` },
    translations: [
      {
        appLocale: "en",
        value: { footnotes: "", text: `Technical translation ${inSurah}` },
      },
      {
        appLocale: "id",
        value: { footnotes: "", text: `Terjemahan teknis ${inSurah}` },
      },
    ],
  });
}

/** Creates one coherent immutable Quran chunk for protocol tests. */
export function makeQuranChunk(input: {
  readonly firstQuranNumber: number;
  readonly firstVerse: number;
  readonly surahNumber: number;
  readonly verseCount: number;
}): QuranChunkRow {
  const verses = Array.from({ length: input.verseCount }, (_, index) =>
    makeQuranVerse(input.firstQuranNumber + index, input.firstVerse + index)
  );
  return Schema.decodeUnknownSync(QuranChunkRowSchema)({
    firstQuranNumber: input.firstQuranNumber,
    firstVerse: input.firstVerse,
    kind: "quran-chunk",
    lastVerse: input.firstVerse + input.verseCount - 1,
    surahNumber: input.surahNumber,
    verses,
  });
}

/** Creates one localized search row whose text is safe for test assertions. */
export function makeQuranSearch(
  appLocale: AppLocaleCode,
  surahNumber: number,
  text = `Technical search text ${surahNumber}`
): QuranSearchRow {
  return Schema.decodeSync(QuranSearchRowSchema)({
    appLocale,
    graph: {
      alignmentId: `alignment:quran:quran-surah:${surahNumber}`,
      assetId: `asset:${appLocale}:quran:quran-surah:${surahNumber}`,
      conceptId: `concept:quran:surah:${surahNumber}`,
      learningObjectId: `lo:quran-surah:${surahNumber}`,
      lensId: "lens:quran",
    },
    kind: "quran-search",
    route: PublicPathSchema.make(`quran/${surahNumber}`),
    surahNumber,
    text,
    title: `Technical Surah ${surahNumber}`,
  });
}

/** Encodes one authentic snapshot envelope for signed Quran consumer tests. */
export function encodeTestQuranRow(
  snapshotId: Sha256Hash,
  payload: QuranRowPayload
) {
  const record = Effect.runSync(bindQuranRow(snapshotId, payload));
  return canonicalizeContentSnapshotRow({ family: "quran", record });
}
