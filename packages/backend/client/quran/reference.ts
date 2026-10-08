import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import {
  QuranRuntimeVerseSchema,
  QuranSearchRowSchema,
} from "@nakafa/aksara-contracts/quran/snapshot/row";
import { hasExactQuranVerseRange } from "@repo/backend/client/quran/integrity";
import {
  decodePublishedQuranSource,
  type PublishedQuranSource,
  quranPublicationError,
} from "@repo/backend/client/quran/publication";
import {
  decodeQuranChunkVerses,
  decodeQuranSearchRow,
  decodeQuranSurahRow,
  type QuranSearchRow,
} from "@repo/backend/client/quran/rows";
import { hasExpectedQuranSources } from "@repo/backend/client/quran/source";
import {
  quranReadingSourcesValidator,
  quranTafsirAccessValidator,
} from "@repo/backend/confect/contentRelease/quran/spec";
import { separateQuranRuntimeBismillah } from "@repo/backend/content/quran/bismillah";
import { PublishedQuranSurahSchema } from "@repo/backend/content/quran/contract";
import { quranPassageValidator } from "@repo/backend/content/quran/response";
import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { Effect, Schema } from "effect";

type QuranReferenceResult = FunctionReturnType<
  typeof api.contentRelease.quran.passage
>;

/** Decoded and passed-through fields of one bounded signed Quran passage. */
const PublishedQuranReferenceFieldsSchema = Schema.Struct({
  fromVerse: quranPassageValidator.fields.fromVerse,
  preBismillah: quranPassageValidator.fields.preBismillah,
  search: QuranSearchRowSchema,
  sources: quranReadingSourcesValidator,
  surah: PublishedQuranSurahSchema,
  tafsirAccess: quranTafsirAccessValidator,
  toVerse: quranPassageValidator.fields.toVerse,
  verses: Schema.Array(QuranRuntimeVerseSchema),
});

/** One bounded signed Quran passage in its canonical shape. */
export type PublishedQuranReference = PublishedQuranSource &
  typeof PublishedQuranReferenceFieldsSchema.Type;

/** Decodes one bounded active signed Quran passage. */
export const decodePublishedQuranReference = Effect.fn(
  "NakafaQuran.decodeReference"
)(function* (
  result: QuranReferenceResult,
  expected: {
    readonly appLocale: AppLocaleCode;
    readonly surahNumber: number;
  }
) {
  const source = yield* decodePublishedQuranSource(result, "reference");
  if (
    result.surahJson === null ||
    result.searchJson === null ||
    result.sources === null ||
    result.tafsirAccess === null ||
    !hasExpectedQuranSources(
      result.sources,
      result.tafsirAccess,
      expected.appLocale
    )
  ) {
    return yield* quranPublicationError(
      "reference",
      "Signed Quran reference is missing."
    );
  }
  const [surah, search, chunkVerses] = yield* Effect.all([
    decodeQuranSurahRow(result.surahJson, source.snapshotId, "reference"),
    decodeQuranSearchRow(result.searchJson, source.snapshotId, "reference"),
    decodeQuranChunkVerses(
      result.chunkJson,
      source.snapshotId,
      "reference",
      expected.surahNumber
    ),
  ]);
  const selectedVerses = chunkVerses.filter(
    (verse) =>
      verse.number.inSurah >= result.fromVerse &&
      verse.number.inSurah <= result.toVerse
  );
  const projected = separateQuranRuntimeBismillah(
    result.preBismillah,
    selectedVerses
  );
  const verses = projected.verses;
  if (
    surah.number !== expected.surahNumber ||
    result.fromVerse < 1 ||
    result.toVerse > surah.numberOfVerses ||
    !hasExactQuranVerseRange(verses, result.fromVerse, result.toVerse) ||
    !hasExpectedSearchIdentity(search, expected.appLocale, expected.surahNumber)
  ) {
    return yield* quranPublicationError(
      "reference",
      "Signed Quran reference identity is inconsistent."
    );
  }
  if (result.preBismillah !== null && projected.preBismillah === null) {
    return yield* quranPublicationError(
      "reference",
      "Signed Quran Bismillah identity is inconsistent."
    );
  }
  return {
    ...source,
    fromVerse: result.fromVerse,
    preBismillah: projected.preBismillah,
    search,
    sources: result.sources,
    surah,
    tafsirAccess: result.tafsirAccess,
    toVerse: result.toVerse,
    verses,
  } satisfies PublishedQuranReference;
});

/** Checks the app-locale search identity returned beside one surah. */
function hasExpectedSearchIdentity(
  search: QuranSearchRow,
  appLocale: AppLocaleCode,
  surahNumber: number
) {
  return (
    search.appLocale === appLocale &&
    search.surahNumber === surahNumber &&
    search.route === `quran/${surahNumber}`
  );
}
