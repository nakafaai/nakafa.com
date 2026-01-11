import { getSurah } from "@repo/contents/_lib/quran";
import type { ContentPagination } from "@repo/contents/_types/content";
import type { Surah } from "@repo/contents/_types/quran";
import { Effect } from "effect";

/**
 * Input parameters for fetching Quran surah context.
 */
export interface FetchSurahContextInput {
  /** The surah number (1-114) */
  surah: number;
}

/**
 * Output data containing fetched Quran surah context.
 */
export interface FetchSurahContextOutput {
  /** The current surah data (guaranteed to be defined) */
  surahData: Surah;
  /** The previous surah data (can be null if this is the first surah) */
  prevSurah: Surah | null;
  /** The next surah data (can be null if this is the last surah) */
  nextSurah: Surah | null;
}

/**
 * Output data containing fetched Quran surah metadata context.
 */
export interface FetchSurahMetadataContextOutput {
  /** The surah data for metadata generation (guaranteed to be defined) */
  surahData: Surah;
}

/**
 * Fetches the Quran surah context including current, previous, and next surah data.
 * Returns an error if the surah number is invalid or not found.
 *
 * @param input - The input parameters for fetching surah context
 * @param input.surah - The surah number (1-114)
 * @returns An Effect that resolves to the surah context or fails with an Error
 */
export function fetchSurahContext({
  surah,
}: FetchSurahContextInput): Effect.Effect<FetchSurahContextOutput, Error> {
  return Effect.gen(function* () {
    const [surahData, prevSurah, nextSurah] = yield* Effect.all([
      getSurah(surah),
      Effect.orElse(getSurah(surah - 1), () => Effect.succeed(null)),
      Effect.orElse(getSurah(surah + 1), () => Effect.succeed(null)),
    ]);

    if (surahData === null) {
      return yield* Effect.fail(new Error("Surah not found"));
    }

    return {
      surahData,
      prevSurah,
      nextSurah,
    };
  });
}

/**
 * Fetches the Quran surah metadata context.
 * Returns an error if the surah number is invalid or not found.
 *
 * @param input - The input parameters for fetching surah metadata context
 * @param input.surah - The surah number (1-114)
 * @returns An Effect that resolves to the surah metadata context or fails with an Error
 */
export function fetchSurahMetadataContext({
  surah,
}: FetchSurahContextInput): Effect.Effect<
  FetchSurahMetadataContextOutput,
  Error
> {
  return Effect.gen(function* () {
    const surahData = yield* Effect.orElse(getSurah(surah), () =>
      Effect.succeed(null)
    );

    if (surahData === null) {
      return yield* Effect.fail(new Error("Surah not found"));
    }

    return { surahData };
  });
}

/**
 * Creates pagination data for Quran surah navigation.
 *
 * @param prevSurah - The previous surah data (can be null)
 * @param nextSurah - The next surah data (can be null)
 * @returns Pagination data with prev/next navigation links and titles
 */
export function getQuranPagination({
  prevSurah,
  nextSurah,
}: {
  prevSurah: FetchSurahContextOutput["prevSurah"];
  nextSurah: FetchSurahContextOutput["nextSurah"];
}): ContentPagination {
  return {
    prev: {
      href: prevSurah ? `/quran/${prevSurah.number}` : "",
      title: prevSurah ? prevSurah.name.translation.en : "",
    },
    next: {
      href: nextSurah ? `/quran/${nextSurah.number}` : "",
      title: nextSurah ? nextSurah.name.translation.en : "",
    },
  };
}
