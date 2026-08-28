import { decodePublishedQuranSurah } from "@repo/backend/client/quran/catalog";
import { hasExactQuranVerseRange } from "@repo/backend/client/quran/integrity";
import {
  decodePublishedQuranSource,
  QuranPublicationError,
} from "@repo/backend/client/quran/publication";
import { hasExpectedQuranSources } from "@repo/backend/client/quran/source";
import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { Effect } from "effect";

type QuranDocumentResult = FunctionReturnType<
  typeof api.contentRelease.quran.surah
>;
/** Validator-derived Quran document verse returned by the public API. */
export type QuranDocumentVerse = QuranDocumentResult["verses"][number];
/** Validator-derived public Quran surah metadata. */
export type QuranDocumentSurah = NonNullable<QuranDocumentResult["surah"]>;
/** Decodes one active app-locale Quran API document projection. */
export const decodePublishedQuranDocument = Effect.fn(
  "NakafaQuran.decodeDocument"
)(function* (
  result: QuranDocumentResult,
  expected: {
    readonly appLocale: QuranDocumentResult["appLocale"];
    readonly surahNumber: number;
  }
) {
  const source = yield* decodePublishedQuranSource(result, "document");
  if (
    result.surah === null ||
    result.sources === null ||
    result.tafsirAccess === null ||
    !hasExpectedQuranSources(
      result.sources,
      result.tafsirAccess,
      expected.appLocale
    )
  ) {
    return yield* new QuranPublicationError({
      operation: "document",
      reason: "Signed Quran document is missing.",
    });
  }
  if (
    result.appLocale !== expected.appLocale ||
    result.surah.number !== expected.surahNumber ||
    !hasExactQuranVerseRange(result.verses, 1, result.surah.numberOfVerses)
  ) {
    return yield* new QuranPublicationError({
      operation: "document",
      reason: "Signed Quran document identity is inconsistent.",
    });
  }
  const surah = yield* decodePublishedQuranSurah(result.surah, "document");
  return {
    ...source,
    appLocale: result.appLocale,
    preBismillah: result.preBismillah,
    sources: result.sources,
    surah,
    tafsirAccess: result.tafsirAccess,
    verses: result.verses,
  };
});
export type PublishedQuranDocument = Effect.Success<
  ReturnType<typeof decodePublishedQuranDocument>
>;
