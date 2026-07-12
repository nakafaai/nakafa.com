import { api } from "@repo/backend/convex/_generated/api";
import type { FunctionArgs } from "convex/server";
import { Effect } from "effect";
import {
  fetchRuntimeQuery,
  readRuntimeQuery,
} from "@/lib/content/runtime/query";

type ArticlePageArgs = FunctionArgs<
  typeof api.contents.queries.runtime.getArticlePage
>;
type CurriculumPageArgs = FunctionArgs<
  typeof api.contents.queries.runtime.getCurriculumPage
>;
type QuranSurahMetadataArgs = FunctionArgs<
  typeof api.contents.queries.runtime.getQuranSurahMetadata
>;
type QuranSurahPageArgs = FunctionArgs<
  typeof api.contents.queries.runtime.getQuranSurahPage
>;

/**
 * Reads an article page from Convex through a Promise boundary for static RSCs.
 *
 * This avoids starting Effect's runtime before Next.js observes uncached data
 * during prerender. See https://nextjs.org/docs/messages/next-prerender-current-time.
 */
export function fetchRuntimeArticlePage(args: ArticlePageArgs) {
  return fetchRuntimeQuery(api.contents.queries.runtime.getArticlePage, args);
}

/**
 * Reads a curriculum lesson from Convex through a Promise boundary for static RSCs.
 *
 * This avoids starting Effect's runtime before Next.js observes uncached data
 * during prerender. See https://nextjs.org/docs/messages/next-prerender-current-time.
 */
export function fetchRuntimeCurriculumPage(args: CurriculumPageArgs) {
  return fetchRuntimeQuery(
    api.contents.queries.runtime.getCurriculumPage,
    args
  );
}

/** Reads one Quran surah metadata row without loading verse documents. */
export function fetchRuntimeQuranSurahMetadata(args: QuranSurahMetadataArgs) {
  return fetchRuntimeQuery(
    api.contents.queries.runtime.getQuranSurahMetadata,
    args
  );
}

/**
 * Reads a Quran surah page from Convex through a Promise boundary for static RSCs.
 *
 * This avoids starting Effect's runtime before Next.js observes uncached data
 * during prerender. See https://nextjs.org/docs/messages/next-prerender-current-time.
 */
export function fetchRuntimeQuranSurahPage(args: QuranSurahPageArgs) {
  return fetchRuntimeQuery(
    api.contents.queries.runtime.getQuranSurahPage,
    args
  );
}

/**
 * Lists Quran surah metadata from Convex through a Promise boundary for static RSCs.
 *
 * This avoids starting Effect's runtime before Next.js observes uncached data
 * during prerender. See https://nextjs.org/docs/messages/next-prerender-current-time.
 */
export function fetchRuntimeQuranSurahs() {
  return fetchRuntimeQuery(api.contents.queries.runtime.listQuranSurahs, {});
}

/** Reads an article page from the Convex content runtime model. */
export const getRuntimeArticlePage = Effect.fn("www.contentRuntime.article")(
  function* (args: ArticlePageArgs) {
    return yield* readRuntimeQuery("getArticlePage", () =>
      fetchRuntimeArticlePage(args)
    );
  }
);

/** Reads a curriculum lesson from the Convex content runtime model. */
export const getRuntimeCurriculumPage = Effect.fn(
  "www.contentRuntime.curriculumLesson"
)(function* (args: CurriculumPageArgs) {
  return yield* readRuntimeQuery("getCurriculumPage", () =>
    fetchRuntimeCurriculumPage(args)
  );
});

/** Reads one Quran surah metadata row from the Convex content runtime model. */
export const getRuntimeQuranSurahMetadata = Effect.fn(
  "www.contentRuntime.quranSurahMetadata"
)(function* (args: QuranSurahMetadataArgs) {
  return yield* readRuntimeQuery("getQuranSurahMetadata", () =>
    fetchRuntimeQuranSurahMetadata(args)
  );
});

/** Reads a Quran surah page from the Convex content runtime model. */
export const getRuntimeQuranSurahPage = Effect.fn(
  "www.contentRuntime.quranSurah"
)(function* (args: QuranSurahPageArgs) {
  return yield* readRuntimeQuery("getQuranSurahPage", () =>
    fetchRuntimeQuranSurahPage(args)
  );
});

/** Lists Quran surah metadata from the Convex content runtime model. */
export const getRuntimeQuranSurahs = Effect.fn(
  "www.contentRuntime.quranSurahs"
)(function* () {
  return yield* readRuntimeQuery("listQuranSurahs", () =>
    fetchRuntimeQuranSurahs()
  );
});
