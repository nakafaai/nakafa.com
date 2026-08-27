import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type { QuranRuntimeVerse } from "@nakafa/aksara-contracts/quran/snapshot/row";
import type { QuranSurahRow } from "@nakafa/aksara-contracts/quran/spec";
import { hasExactQuranVerseRange } from "@repo/backend/client/quran/integrity";
import { quranPublicationError } from "@repo/backend/client/quran/publication";
import {
  decodeQuranChunkVerses,
  decodeQuranSearchRow,
  decodeQuranSurahRow,
  type QuranSearchRow,
} from "@repo/backend/client/quran/rows";
import {
  decodePublishedQuranSourceV2,
  type PublishedQuranSourceV2,
} from "@repo/backend/client/quran/v2/publication";
import { hasExpectedQuranSourcesV2 } from "@repo/backend/client/quran/v2/source";
import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { Effect } from "effect";

type QuranReferenceResult = FunctionReturnType<
  typeof api.contentRelease.quran.referenceV2
>;

/** One bounded signed Quran reference in the canonical V2 shape. */
export type PublishedQuranReferenceV2 = PublishedQuranSourceV2 & {
  readonly fromVerse: number;
  readonly search: QuranSearchRow;
  readonly sources: NonNullable<QuranReferenceResult["sources"]>;
  readonly surah: QuranSurahRow;
  readonly tafsirAccess: QuranReferenceResult["tafsirAccess"];
  readonly toVerse: number;
  readonly verses: readonly QuranRuntimeVerse[];
};

/** Decodes one bounded active signed Quran verse reference as V2. */
export const decodePublishedQuranReferenceV2 = Effect.fn(
  "NakafaQuran.decodeReferenceV2"
)(function* (
  result: QuranReferenceResult,
  expected: {
    readonly appLocale: AppLocaleCode;
    readonly surahNumber: number;
  }
) {
  const source = yield* decodePublishedQuranSourceV2(result, "reference");
  if (
    result.surahJson === null ||
    result.searchJson === null ||
    !hasExpectedQuranSourcesV2(
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
  const verses = chunkVerses.filter(
    (verse) =>
      verse.number.inSurah >= result.fromVerse &&
      verse.number.inSurah <= result.toVerse
  );
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
  return {
    ...source,
    fromVerse: result.fromVerse,
    search,
    sources: result.sources,
    surah,
    tafsirAccess: result.tafsirAccess,
    toVerse: result.toVerse,
    verses,
  } satisfies PublishedQuranReferenceV2;
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
