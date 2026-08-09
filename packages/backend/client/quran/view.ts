import { QURAN_SURAH_COUNT } from "@nakafa/aksara-contracts/quran/spec";
import {
  decodePublishedQuranSource,
  QuranPublicationError,
} from "@repo/backend/client/quran/decode";
import {
  hasExactQuranVerseRange,
  hasExpectedQuranNeighbors,
} from "@repo/backend/client/quran/integrity";
import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { Effect } from "effect";

type QuranViewResult = FunctionReturnType<typeof api.contentRelease.quran.view>;

/** One validator-derived verse rendered by the locale-specific Quran web view. */
export type QuranViewVerse = QuranViewResult["verses"][number];

/** Minimal validator-derived surah metadata rendered by the Quran web view. */
export type QuranViewSurah = NonNullable<QuranViewResult["surah"]>;

/** Decodes one active locale-specific Quran web projection. */
export const decodePublishedQuranView = Effect.fn("NakafaQuran.decodeView")(
  function* (
    result: QuranViewResult,
    expected: {
      readonly locale: QuranViewResult["locale"];
      readonly surahNumber: number;
    }
  ) {
    const source = yield* decodePublishedQuranSource(result, "view");
    if (result.surah === null) {
      return yield* new QuranPublicationError({
        operation: "view",
        reason: "Signed Quran view is missing.",
      });
    }
    if (
      result.locale !== expected.locale ||
      result.surah.number !== expected.surahNumber ||
      !hasExactQuranVerseRange(result.verses, 1, result.surah.numberOfVerses) ||
      !hasExpectedQuranNeighbors(
        result.previousSurah,
        result.nextSurah,
        expected.surahNumber,
        QURAN_SURAH_COUNT
      )
    ) {
      return yield* new QuranPublicationError({
        operation: "view",
        reason: "Signed Quran view identity is inconsistent.",
      });
    }

    return {
      ...source,
      locale: result.locale,
      nextSurah: result.nextSurah,
      previousSurah: result.previousSurah,
      surah: result.surah,
      verses: result.verses,
    };
  }
);

export type PublishedQuranView = Effect.Effect.Success<
  ReturnType<typeof decodePublishedQuranView>
>;
