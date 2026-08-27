import {
  type AppLocaleCode,
  ENGLISH_APP_LOCALE_CODE,
  GERMAN_APP_LOCALE_CODE,
  INDONESIAN_APP_LOCALE_CODE,
} from "@nakafa/aksara-contracts/locale";
import {
  type QuranEmbeddedSourceId,
  type QuranExternalSourceId,
  quranReadingSourceIds,
  quranTafsirSourceId,
  quranTranslationSourceId,
} from "@nakafa/aksara-contracts/quran/identity";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { readQuranAttributionRow } from "@repo/backend/convex/contentRelease/quran/attribution";
import { Effect } from "effect";

type QuranAttribution = Effect.Success<
  ReturnType<typeof readQuranAttributionRow>
>;
type QuranAttributedSource = QuranAttribution["payload"]["sources"][number];
const ARABIC_SOURCE_ID = quranReadingSourceIds(ENGLISH_APP_LOCALE_CODE)[0];

/** Projects one verified embedded source and its exact localized signed copy. */
const projectEmbeddedQuranSource = Effect.fn(
  "contentRelease.projectEmbeddedQuranSource"
)(function* <const SourceId extends QuranEmbeddedSourceId>(
  source: QuranAttributedSource | undefined,
  appLocale: AppLocaleCode,
  sourceId: SourceId,
  snapshotId: string
) {
  if (source === undefined || source.id !== sourceId) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Active Quran snapshot ${snapshotId} has no source ${sourceId}.`
    );
  }
  const copy = source.copy.find(
    (candidate) => candidate.appLocale === appLocale
  );
  if (copy === undefined) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Active Quran snapshot ${snapshotId} has no localized source copy for ${sourceId}/${appLocale}.`
    );
  }
  if (!("artifact" in source)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Active Quran snapshot ${snapshotId} has a non-embedded source for ${sourceId}.`
    );
  }
  return {
    artifact: source.artifact,
    id: sourceId,
    kind: "embedded" as const,
    label: copy.title,
    notice: copy.notice,
    publisher: source.publisher,
    retrievedAt: source.retrievedAt,
    sourceUrl: source.sourceUrl,
    updateUrl: source.updateUrl,
    version: source.version,
    terms: source.terms,
  };
});

/** Projects one verified external source and its exact localized signed copy. */
const projectExternalQuranSource = Effect.fn(
  "contentRelease.projectExternalQuranSource"
)(function* <const SourceId extends QuranExternalSourceId>(
  source: QuranAttributedSource | undefined,
  appLocale: AppLocaleCode,
  sourceId: SourceId,
  snapshotId: string
) {
  if (source === undefined || !("kind" in source) || source.id !== sourceId) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Active Quran snapshot ${snapshotId} has no external source ${sourceId}.`
    );
  }
  if (source.kind !== "external") {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Active Quran snapshot ${snapshotId} has a non-external source for ${sourceId}.`
    );
  }
  const copy = source.copy.find(
    (candidate) => candidate.appLocale === appLocale
  );
  if (copy === undefined) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Active Quran snapshot ${snapshotId} has no localized source copy for ${sourceId}/${appLocale}.`
    );
  }
  return {
    id: sourceId,
    kind: "external" as const,
    label: copy.title,
    notice: copy.notice,
    publisher: source.publisher,
    retrievedAt: source.retrievedAt,
    sourceUrl: source.sourceUrl,
    terms: source.terms,
    updateUrl: source.updateUrl,
    version: source.version,
  };
});

/** Projects one exact Arabic and locale-selected translation relationship. */
const projectQuranReadingSourcesFor = Effect.fn(
  "contentRelease.projectQuranReadingSourcesFor"
)(function* <
  const Locale extends AppLocaleCode,
  const TranslationId extends QuranEmbeddedSourceId,
>(
  attribution: QuranAttribution,
  snapshotId: string,
  appLocale: Locale,
  translationSourceId: TranslationId
) {
  const [arabic, translation] = yield* Effect.all(
    [
      projectEmbeddedQuranSource(
        attribution.payload.sources.find(({ id }) => id === ARABIC_SOURCE_ID),
        appLocale,
        ARABIC_SOURCE_ID,
        snapshotId
      ),
      projectEmbeddedQuranSource(
        attribution.payload.sources.find(
          ({ id }) => id === translationSourceId
        ),
        appLocale,
        translationSourceId,
        snapshotId
      ),
    ],
    { concurrency: "unbounded" }
  );
  return { arabic, translation };
});

/** Preserves the exact locale and translation-source union in the return type. */
const projectQuranReadingSources = Effect.fn(
  "contentRelease.projectQuranReadingSources"
)(function* (
  attribution: QuranAttribution,
  snapshotId: string,
  appLocale: AppLocaleCode
) {
  if (appLocale === ENGLISH_APP_LOCALE_CODE) {
    return yield* projectQuranReadingSourcesFor(
      attribution,
      snapshotId,
      appLocale,
      quranTranslationSourceId(ENGLISH_APP_LOCALE_CODE)
    );
  }
  if (appLocale === INDONESIAN_APP_LOCALE_CODE) {
    return yield* projectQuranReadingSourcesFor(
      attribution,
      snapshotId,
      appLocale,
      quranTranslationSourceId(INDONESIAN_APP_LOCALE_CODE)
    );
  }
  return yield* projectQuranReadingSourcesFor(
    attribution,
    snapshotId,
    appLocale,
    quranTranslationSourceId(GERMAN_APP_LOCALE_CODE)
  );
});

/** Reads complete signed reading sources and locale-specific Tafsir access. */
export const readQuranLocaleSources = Effect.fn(
  "contentRelease.readQuranLocaleSources"
)(function* (ctx: QueryCtx, snapshotId: string, appLocale: AppLocaleCode) {
  const attribution = yield* readQuranAttributionRow(ctx, snapshotId);
  const sources = yield* projectQuranReadingSources(
    attribution,
    snapshotId,
    appLocale
  );
  if (attribution.contract === "legacy") {
    if (appLocale !== INDONESIAN_APP_LOCALE_CODE) {
      return { sources, tafsirAccess: null };
    }
    const legacyTafsirSourceId = quranTafsirSourceId(
      INDONESIAN_APP_LOCALE_CODE
    );
    const source = yield* projectEmbeddedQuranSource(
      attribution.payload.sources.find(({ id }) => id === legacyTafsirSourceId),
      appLocale,
      legacyTafsirSourceId,
      snapshotId
    );
    if (source.kind !== "embedded") {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Active Quran snapshot ${snapshotId} has invalid legacy Tafsir access for ${appLocale}.`
      );
    }
    return {
      sources,
      tafsirAccess: {
        appLocale,
        kind: source.kind,
        notice: source.notice,
        source,
      },
    };
  }

  const expectedTafsirSourceId = quranTafsirSourceId(appLocale);
  const access = attribution.payload.tafsirAccess.find(
    (candidate) => candidate.appLocale === appLocale
  );
  if (access === undefined || access.sourceId !== expectedTafsirSourceId) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Active Quran snapshot ${snapshotId} has invalid Tafsir access for ${appLocale}.`
    );
  }
  const sourceAttribution = attribution.payload.sources.find(
    ({ id }) => id === access.sourceId
  );
  if (access.kind === "embedded") {
    const sourceId = quranTafsirSourceId(INDONESIAN_APP_LOCALE_CODE);
    const source = yield* projectEmbeddedQuranSource(
      sourceAttribution,
      INDONESIAN_APP_LOCALE_CODE,
      sourceId,
      snapshotId
    );
    return {
      sources,
      tafsirAccess: {
        appLocale: INDONESIAN_APP_LOCALE_CODE,
        kind: source.kind,
        notice: access.notice,
        source,
      },
    };
  }
  if (access.appLocale === ENGLISH_APP_LOCALE_CODE) {
    const sourceId = quranTafsirSourceId(ENGLISH_APP_LOCALE_CODE);
    const source = yield* projectExternalQuranSource(
      sourceAttribution,
      ENGLISH_APP_LOCALE_CODE,
      sourceId,
      snapshotId
    );
    return {
      sources,
      tafsirAccess: {
        appLocale: ENGLISH_APP_LOCALE_CODE,
        kind: source.kind,
        notice: access.notice,
        source,
      },
    };
  }
  const sourceId = quranTafsirSourceId(GERMAN_APP_LOCALE_CODE);
  const source = yield* projectExternalQuranSource(
    sourceAttribution,
    GERMAN_APP_LOCALE_CODE,
    sourceId,
    snapshotId
  );
  return {
    sources,
    tafsirAccess: {
      appLocale: GERMAN_APP_LOCALE_CODE,
      kind: source.kind,
      notice: access.notice,
      source,
    },
  };
});
