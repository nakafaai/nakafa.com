import { QURAN_SURAH_COUNT } from "@nakafa/aksara-contracts/quran/spec";
import {
  hasExactQuranVerseRange,
  hasExpectedQuranNeighbors,
} from "@repo/backend/client/quran/integrity";
import { QuranPublicationError } from "@repo/backend/client/quran/publication";
import { decodePublishedQuranSourceV2 } from "@repo/backend/client/quran/v2/publication";
import { hasExpectedQuranSourcesV2 } from "@repo/backend/client/quran/v2/source";
import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { Effect } from "effect";

type QuranViewResult = FunctionReturnType<
  typeof api.contentRelease.quran.viewV2
>;
/** Minimal validator-derived surah metadata rendered by the Quran web view. */
export type QuranViewSurahV2 = NonNullable<QuranViewResult["surah"]>;
/** Signed locale-specific Tafsir access rendered by the Quran web view. */
export type QuranViewTafsirAccessV2 = NonNullable<
  QuranViewResult["tafsirAccess"]
>;
/** Exact signed Arabic and locale translation sources rendered by the page. */
export type QuranViewSourcesV2 = NonNullable<QuranViewResult["sources"]>;
/** Decodes one active app-locale Quran web projection. */
export const decodePublishedQuranViewV2 = Effect.fn("NakafaQuran.decodeViewV2")(
  function* (
    result: QuranViewResult,
    expected: {
      readonly appLocale: QuranViewResult["appLocale"];
      readonly surahNumber: number;
    }
  ) {
    const source = yield* decodePublishedQuranSourceV2(result, "view");
    if (
      result.surah === null ||
      !hasExpectedQuranSourcesV2(
        result.sources,
        result.tafsirAccess,
        expected.appLocale
      )
    ) {
      return yield* new QuranPublicationError({
        operation: "view",
        reason: "Signed Quran view is missing.",
      });
    }
    if (
      result.appLocale !== expected.appLocale ||
      (result.tafsirAccess !== null &&
        result.tafsirAccess.appLocale !== expected.appLocale) ||
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
      appLocale: result.appLocale,
      nextSurah: result.nextSurah,
      previousSurah: result.previousSurah,
      sources: result.sources,
      surah: result.surah,
      tafsirAccess: result.tafsirAccess,
      verses: result.verses,
    };
  }
);
export type PublishedQuranViewV2 = Effect.Success<
  ReturnType<typeof decodePublishedQuranViewV2>
>;
/** One semantic verse rendered by the app-locale Quran web view. */
export type QuranViewVerseV2 = PublishedQuranViewV2["verses"][number];
