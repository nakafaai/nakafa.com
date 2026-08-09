import {
  decodePublishedQuranSource,
  QuranPublicationError,
} from "@repo/backend/client/quran/decode";
import { hasExactQuranVerseRange } from "@repo/backend/client/quran/integrity";
import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { Effect } from "effect";

type QuranMarkdownResult = FunctionReturnType<
  typeof api.contentRelease.quran.markdown
>;

/** Validator-derived Quran verse used by markdown renderers. */
export type QuranMarkdownVerse = QuranMarkdownResult["verses"][number];

/** Validator-derived Quran metadata used by markdown renderers. */
export type QuranMarkdownSurah = NonNullable<QuranMarkdownResult["surah"]>;

/** Decodes one active locale-specific Quran markdown projection. */
export const decodePublishedQuranMarkdown = Effect.fn(
  "NakafaQuran.decodeMarkdown"
)(function* (
  result: QuranMarkdownResult,
  expected: {
    readonly locale: QuranMarkdownResult["locale"];
    readonly surahNumber: number;
    readonly verseLimit?: number;
  }
) {
  const source = yield* decodePublishedQuranSource(result, "markdown");
  if (result.surah === null) {
    return yield* new QuranPublicationError({
      operation: "markdown",
      reason: "Signed Quran markdown is missing.",
    });
  }
  const expectedToVerse = Math.min(
    expected.verseLimit ?? result.surah.numberOfVerses,
    result.surah.numberOfVerses
  );
  if (
    result.locale !== expected.locale ||
    result.surah.number !== expected.surahNumber ||
    result.toVerse !== expectedToVerse ||
    !hasExactQuranVerseRange(result.verses, 1, expectedToVerse)
  ) {
    return yield* new QuranPublicationError({
      operation: "markdown",
      reason: "Signed Quran markdown identity is inconsistent.",
    });
  }

  return {
    ...source,
    locale: result.locale,
    surah: result.surah,
    toVerse: result.toVerse,
    verses: result.verses,
  };
});

export type PublishedQuranMarkdown = Effect.Effect.Success<
  ReturnType<typeof decodePublishedQuranMarkdown>
>;
