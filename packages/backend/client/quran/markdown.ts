import { hasExactQuranVerseRange } from "@repo/backend/client/quran/integrity";
import {
  decodePublishedQuranSource,
  QuranPublicationError,
} from "@repo/backend/client/quran/publication";
import { hasExpectedQuranSources } from "@repo/backend/client/quran/source";
import type { QuranMarkdown } from "@repo/backend/convex/contentRelease/quran/markdown";
import { Effect } from "effect";

/** Renders signed locale-specific Tafsir availability for agent Markdown. */
export function renderQuranTafsirAccessMarkdown(
  access: QuranMarkdown["tafsirAccess"]
): readonly string[] {
  if (access === null) {
    return [];
  }
  return [
    "## Tafsir access",
    "",
    access.notice,
    "",
    `Source: [${access.source.label}](${access.source.sourceUrl})`,
    `Updates: [Edition updates](${access.source.updateUrl})`,
    `Terms: [Usage terms](${access.source.terms.url})`,
    "",
  ];
}

/** Decodes one active app-locale Quran markdown projection. */
export const decodePublishedQuranMarkdown = Effect.fn(
  "NakafaQuran.decodeMarkdown"
)(function* (
  result: QuranMarkdown,
  expected: {
    readonly appLocale: QuranMarkdown["appLocale"];
    readonly surahNumber: number;
    readonly verseLimit?: number;
  }
) {
  const source = yield* decodePublishedQuranSource(result, "markdown");
  if (
    result.surah === null ||
    !hasExpectedQuranSources(
      result.sources,
      result.tafsirAccess,
      expected.appLocale
    )
  ) {
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
    result.appLocale !== expected.appLocale ||
    (result.tafsirAccess !== null &&
      result.tafsirAccess.appLocale !== expected.appLocale) ||
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
    appLocale: result.appLocale,
    preBismillah: result.preBismillah,
    sources: result.sources,
    surah: result.surah,
    tafsirAccess: result.tafsirAccess,
    toVerse: result.toVerse,
    verses: result.verses,
  };
});
export type PublishedQuranMarkdown = Effect.Success<
  ReturnType<typeof decodePublishedQuranMarkdown>
>;
