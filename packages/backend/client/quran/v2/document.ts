import { hasExactQuranVerseRange } from "@repo/backend/client/quran/integrity";
import { QuranPublicationError } from "@repo/backend/client/quran/publication";
import { decodePublishedQuranSourceV2 } from "@repo/backend/client/quran/v2/publication";
import { hasExpectedQuranSourcesV2 } from "@repo/backend/client/quran/v2/source";
import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { Effect } from "effect";

type QuranDocumentResult = FunctionReturnType<
  typeof api.contentRelease.quran.documentV2
>;
/** Validator-derived Quran document verse returned by the public API. */
export type QuranDocumentVerseV2 = QuranDocumentResult["verses"][number];
/** Validator-derived public Quran surah metadata. */
export type QuranDocumentSurahV2 = NonNullable<QuranDocumentResult["surah"]>;
/** Decodes one active app-locale Quran API document projection. */
export const decodePublishedQuranDocumentV2 = Effect.fn(
  "NakafaQuran.decodeDocumentV2"
)(function* (
  result: QuranDocumentResult,
  expected: {
    readonly appLocale: QuranDocumentResult["appLocale"];
    readonly surahNumber: number;
  }
) {
  const source = yield* decodePublishedQuranSourceV2(result, "document");
  if (
    result.surah === null ||
    !hasExpectedQuranSourcesV2(
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
  return {
    ...source,
    appLocale: result.appLocale,
    sources: result.sources,
    surah: result.surah,
    tafsirAccess: result.tafsirAccess,
    verses: result.verses,
  };
});
export type PublishedQuranDocumentV2 = Effect.Success<
  ReturnType<typeof decodePublishedQuranDocumentV2>
>;
