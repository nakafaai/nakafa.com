import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { Effect, Schema } from "effect";
import { getRuntimeQuranSurahPage } from "@/lib/content/runtime";

type QuranSurahPage = NonNullable<
  FunctionReturnType<typeof api.contents.queries.runtime.getQuranSurahPage>
>;
export type QuranSurah = QuranSurahPage["surahData"];
type QuranSurahMetadata = QuranSurahPage["prevSurah"];

/** Failure raised when a Quran surah is absent from the Convex runtime model. */
class QuranSurahNotFoundError extends Schema.TaggedError<QuranSurahNotFoundError>()(
  "QuranSurahNotFoundError",
  {
    surah: Schema.Number,
  }
) {}

/** Input parameters for fetching Quran surah context. */
export interface FetchSurahContextInput {
  /** The surah number (1-114). */
  surah: number;
}

/** Output data containing fetched Quran surah context. */
export interface FetchSurahContextOutput {
  /** The next surah metadata, or null when this is the last surah. */
  nextSurah: QuranSurahMetadata;
  /** The previous surah metadata, or null when this is the first surah. */
  prevSurah: QuranSurahMetadata;
  /** The current surah data with verses. */
  surahData: QuranSurah;
}

/** Output data containing fetched Quran surah metadata context. */
export interface FetchSurahMetadataContextOutput {
  /** The surah data for metadata generation, or null if not found. */
  surahData: QuranSurah | null;
}

/** Navigation data for Quran previous and next links. */
export interface QuranPagination {
  next: {
    href: string;
    title: string;
  };
  prev: {
    href: string;
    title: string;
  };
}

/** Fetches the Quran surah context from Convex runtime rows. */
export function fetchSurahContext({ surah }: FetchSurahContextInput) {
  return Effect.gen(function* () {
    const page = yield* getRuntimeQuranSurahPage({ surah });

    if (!page) {
      return yield* Effect.fail(new QuranSurahNotFoundError({ surah }));
    }

    return {
      nextSurah: page.nextSurah,
      prevSurah: page.prevSurah,
      surahData: page.surahData,
    };
  });
}

/** Fetches Quran surah metadata from Convex runtime rows. */
export function fetchSurahMetadataContext({ surah }: FetchSurahContextInput) {
  return Effect.gen(function* () {
    const page = yield* getRuntimeQuranSurahPage({ surah });

    return {
      surahData: page?.surahData ?? null,
    };
  });
}

/** Creates pagination data for Quran surah navigation. */
export function getQuranPagination({
  prevSurah,
  nextSurah,
}: {
  nextSurah: FetchSurahContextOutput["nextSurah"];
  prevSurah: FetchSurahContextOutput["prevSurah"];
}): QuranPagination {
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

/** Returns the locale-aware display name for one Quran surah. */
export function getQuranSurahName({
  locale,
  name,
}: {
  locale: "en" | "id";
  name: QuranSurah["name"];
}) {
  return name.transliteration[locale];
}
