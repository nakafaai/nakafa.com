import { createNakafaContentRef } from "@repo/contents/_lib/agent/refs";
import type { NakafaAgentContentSummary } from "@repo/contents/_lib/agent/schema/ref";
import {
  type ContentMetadataListItem,
  getContentsMetadata,
} from "@repo/contents/_lib/metadata";
import { getAllSurah, getSurahName } from "@repo/contents/_lib/quran";
import type { Locale } from "@repo/contents/_types/content";
import { routing } from "@repo/internationalization/src/routing";
import { Cache, Duration, Effect, Option } from "effect";

/** Builds the full public Nakafa content index for one locale. */
export const getNakafaAgentContentIndex = Effect.fn(
  "NakafaAgent.getContentIndex"
)(function* (locale: Locale = routing.defaultLocale) {
  return yield* nakafaAgentContentIndexCache.get(locale);
});

const nakafaAgentContentIndexCache = Effect.runSync(
  Cache.make({
    capacity: routing.locales.length,
    timeToLive: Duration.infinity,
    lookup: buildNakafaAgentContentIndex,
  })
);

/** Builds an uncached agent content index entry for one locale. */
function buildNakafaAgentContentIndex(locale: Locale) {
  return Effect.gen(function* () {
    const mdxItems = yield* getNakafaMdxContentSummaries(locale);
    const quranItems = getNakafaQuranSummaries(locale);

    return [...mdxItems, ...quranItems].sort(compareNakafaContentSummaries);
  });
}

/** Provides stable ordering across mixed content sections. */
function compareNakafaContentSummaries(
  left: NakafaAgentContentSummary,
  right: NakafaAgentContentSummary
) {
  return `${left.section}:${left.title}`.localeCompare(
    `${right.section}:${right.title}`
  );
}

/** Builds searchable summaries for articles and lesson material. */
function getNakafaMdxContentSummaries(locale: Locale) {
  return Effect.all(
    [
      getContentsMetadata({ basePath: "articles", locale }),
      getContentsMetadata({ basePath: "material/lesson", locale }),
    ],
    { concurrency: "unbounded" }
  ).pipe(
    Effect.map(([articles, materials]) => [
      ...articles.flatMap((entry) =>
        buildNakafaMdxContentSummary(locale, entry, "articles")
      ),
      ...materials.flatMap((entry) =>
        buildNakafaMdxContentSummary(locale, entry, "material")
      ),
    ])
  );
}

/** Builds one article or material summary from trusted scoped metadata. */
function buildNakafaMdxContentSummary(
  locale: Locale,
  entry: ContentMetadataListItem,
  section: "articles" | "material"
) {
  const ref = createNakafaContentRef(locale, entry.slug, section);

  if (Option.isNone(ref)) {
    return [];
  }

  return [
    {
      ...ref.value,
      description: entry.metadata.description ?? entry.metadata.subject ?? "",
      title: entry.metadata.title,
    },
  ];
}

/** Builds searchable summaries for Quran surahs. */
function getNakafaQuranSummaries(locale: Locale) {
  return getAllSurah().flatMap((surah) => {
    const ref = createNakafaContentRef(
      locale,
      `quran/${surah.number}`,
      "quran"
    );

    if (Option.isNone(ref)) {
      return [];
    }

    return [
      {
        ...ref.value,
        description: surah.name.translation[locale],
        title: `${surah.number}. ${getSurahName({ locale, name: surah.name })}`,
      },
    ];
  });
}
