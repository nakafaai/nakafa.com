import {
  decodePublishedQuranSource,
  QuranPublicationError,
} from "@repo/backend/client/quran/decode";
import { hasExactQuranVerseRange } from "@repo/backend/client/quran/integrity";
import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { Effect } from "effect";

type QuranDocumentResult = FunctionReturnType<
  typeof api.contentRelease.quran.document
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
  if (result.surah === null) {
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
    surah: result.surah,
    verses: result.verses,
  };
});

export type PublishedQuranDocument = Effect.Effect.Success<
  ReturnType<typeof decodePublishedQuranDocument>
>;
