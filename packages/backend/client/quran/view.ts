import { QURAN_SURAH_COUNT } from "@nakafa/aksara-contracts/quran/spec";
import { decodePublishedQuranSurah } from "@repo/backend/client/quran/catalog";
import {
  hasExactQuranVerseRange,
  hasExpectedQuranNeighbors,
} from "@repo/backend/client/quran/integrity";
import {
  decodePublishedQuranSource,
  QuranPublicationError,
} from "@repo/backend/client/quran/publication";
import { hasExpectedQuranSources } from "@repo/backend/client/quran/source";
import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { Effect } from "effect";

type QuranViewResult = FunctionReturnType<typeof api.contentRelease.quran.page>;
/** Minimal validator-derived surah metadata rendered by the Quran web view. */
export type QuranViewSurah = NonNullable<QuranViewResult["surah"]>;
/** Dedicated signed Bismillah shown before numbered verses when present. */
export type QuranViewBismillah = NonNullable<QuranViewResult["preBismillah"]>;
/** Signed locale-specific Tafsir access rendered by the Quran web view. */
export type QuranViewTafsirAccess = NonNullable<
  QuranViewResult["tafsirAccess"]
>;
/** Exact signed Arabic and locale translation sources rendered by the page. */
export type QuranViewSources = NonNullable<QuranViewResult["sources"]>;
/** Decodes one active app-locale Quran web projection. */
export const decodePublishedQuranView = Effect.fn("NakafaQuran.decodeView")(
  function* (
    result: QuranViewResult,
    expected: {
      readonly appLocale: QuranViewResult["appLocale"];
      readonly surahNumber: number;
    }
  ) {
    const source = yield* decodePublishedQuranSource(result, "view");
    if (
      result.surah === null ||
      !hasExpectedQuranSources(
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
    const normalized = yield* Effect.all({
      nextSurah:
        result.nextSurah === null
          ? Effect.succeed(null)
          : decodePublishedQuranSurah(result.nextSurah, "view"),
      previousSurah:
        result.previousSurah === null
          ? Effect.succeed(null)
          : decodePublishedQuranSurah(result.previousSurah, "view"),
      surah: decodePublishedQuranSurah(result.surah, "view"),
    });
    return {
      ...source,
      appLocale: result.appLocale,
      nextSurah: normalized.nextSurah,
      preBismillah: result.preBismillah,
      previousSurah: normalized.previousSurah,
      sources: result.sources,
      surah: normalized.surah,
      tafsirAccess: result.tafsirAccess,
      verses: result.verses,
    };
  }
);
export type PublishedQuranView = Effect.Success<
  ReturnType<typeof decodePublishedQuranView>
>;
/** One semantic verse rendered by the app-locale Quran web view. */
export type QuranViewVerse = PublishedQuranView["verses"][number];
