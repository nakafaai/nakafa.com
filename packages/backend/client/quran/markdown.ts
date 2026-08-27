import { decodePublishedQuranSurah } from "@repo/backend/client/quran/catalog";
import { hasExactQuranVerseRange } from "@repo/backend/client/quran/integrity";
import {
  decodePublishedQuranSource,
  QuranPublicationError,
} from "@repo/backend/client/quran/publication";
import { hasExpectedQuranSources } from "@repo/backend/client/quran/source";
import type { QuranMarkdown } from "@repo/backend/convex/contentRelease/quran/markdown";
import { Effect } from "effect";

type QuranReadingSources = NonNullable<QuranMarkdown["sources"]>;

/** Renders the exact Arabic and translation source bibliography. */
export function renderQuranReadingSourcesMarkdown(
  sources: QuranReadingSources
): readonly string[] {
  return [
    "## Reading sources",
    "",
    ...renderEmbeddedSource("Arabic text", sources.arabic),
    ...renderEmbeddedSource("Translation", sources.translation),
  ];
}

/** Renders one signed embedded source without dropping access metadata. */
function renderEmbeddedSource(
  heading: string,
  source: QuranReadingSources[keyof QuranReadingSources]
): readonly string[] {
  return [
    `### ${heading}`,
    "",
    source.notice,
    "",
    `Source: [${source.label}](${source.sourceUrl})`,
    `Publisher: ${source.publisher}`,
    `Version: ${source.version}`,
    `Retrieved: ${source.retrievedAt}`,
    `Updates: [Edition updates](${source.updateUrl})`,
    `Terms: [Usage terms](${source.terms.url})`,
    "",
  ];
}

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
  const surah = yield* decodePublishedQuranSurah(result.surah, "markdown");
  return {
    ...source,
    appLocale: result.appLocale,
    preBismillah: result.preBismillah,
    sources: result.sources,
    surah,
    tafsirAccess: result.tafsirAccess,
    toVerse: result.toVerse,
    verses: result.verses,
  };
});
export type PublishedQuranMarkdown = Effect.Success<
  ReturnType<typeof decodePublishedQuranMarkdown>
>;
