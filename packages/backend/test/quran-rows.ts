import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import {
  QURAN_SOURCE_IDS,
  QuranAttributionRowSchema,
} from "@nakafa/aksara-contracts/quran/source";
import {
  type QuranChunkRow,
  QuranChunkRowSchema,
  type QuranRuntimeVerse,
  QuranRuntimeVerseSchema,
  type QuranSearchRow,
  QuranSearchRowSchema,
  type QuranSurahRow,
  QuranSurahRowSchema,
} from "@nakafa/aksara-contracts/quran/spec";
import { Schema } from "effect";

const testDigest = `sha256:${"1".repeat(64)}`;

/** Creates the complete technical attribution row required by runtime tests. */
export function makeQuranAttribution() {
  return Schema.decodeUnknownSync(QuranAttributionRowSchema)({
    kind: "quran-attribution",
    sources: QURAN_SOURCE_IDS.map((id) => ({
      artifact: { byteCount: 1, digest: testDigest, fileCount: 1 },
      id,
      notice: "Technical attribution notice",
      publisher: "Nakafa protocol tests",
      retrievedAt: "2026-07-31T00:00:00Z",
      sourceUrl: `https://example.test/${id}`,
      terms: {
        artifact: { byteCount: 1, digest: testDigest, fileCount: 1 },
        url: `https://example.test/${id}/terms`,
      },
      title: `Technical source ${id}`,
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
  return QuranRuntimeVerseSchema.make({
    meta: {
      hizbQuarter: 1,
      juz: 1,
      manzil: 1,
      page: 1,
      ruku: 1,
      sajda: null,
    },
    number: { inQuran, inSurah },
    tafsir: {
      id: { footnotes: null, text: `Tafsir teknis ${inSurah}` },
    },
    text: { arabic: `آية ${inSurah}` },
    translation: {
      en: { footnotes: "", text: `Technical translation ${inSurah}` },
      id: { footnotes: "", text: `Terjemahan teknis ${inSurah}` },
    },
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
  locale: QuranSearchRow["locale"],
  surahNumber: number,
  text = `Technical search text ${surahNumber}`
): QuranSearchRow {
  return QuranSearchRowSchema.make({
    graph: {
      alignmentId: `alignment:quran:quran-surah:${surahNumber}`,
      assetId: `asset:${locale}:quran:quran-surah:${surahNumber}`,
      conceptId: `concept:quran:surah:${surahNumber}`,
      learningObjectId: `lo:quran-surah:${surahNumber}`,
      lensId: "lens:quran",
    },
    kind: "quran-search",
    locale,
    route: PublicPathSchema.make(`quran/${surahNumber}`),
    surahNumber,
    text,
    title: `Technical Surah ${surahNumber}`,
  });
}
