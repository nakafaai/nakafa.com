import {
  type AppLocaleCode,
  AppLocaleSchema,
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
import { readQuranAttributionRow } from "@repo/backend/content/quran/attribution";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
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
  attribution: QuranAttribution,
  appLocale: AppLocaleCode,
  sourceId: SourceId
) {
  const source = yield* Effect.fromNullishOr(
    attribution.payload.sources.find(
      (
        candidate
      ): candidate is Extract<
        QuranAttributedSource,
        { readonly kind: "embedded" }
      > => candidate.kind === "embedded" && candidate.id === sourceId
    )
  );
  const copy = yield* Effect.fromNullishOr(
    source.copy.find((candidate) => candidate.appLocale === appLocale)
  );
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
}, Effect.orDie);

/** Projects one verified external source and its exact localized signed copy. */
const projectExternalQuranSource = Effect.fn(
  "contentRelease.projectExternalQuranSource"
)(function* <const SourceId extends QuranExternalSourceId>(
  attribution: QuranAttribution,
  appLocale: AppLocaleCode,
  sourceId: SourceId
) {
  const source = yield* Effect.fromNullishOr(
    attribution.payload.sources.find(
      (
        candidate
      ): candidate is Extract<
        QuranAttributedSource,
        { readonly kind: "external" }
      > => candidate.kind === "external" && candidate.id === sourceId
    )
  );
  const copy = yield* Effect.fromNullishOr(
    source.copy.find((candidate) => candidate.appLocale === appLocale)
  );
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
}, Effect.orDie);

/** Projects one exact Arabic and locale-selected translation relationship. */
const projectQuranReadingSourcesFor = Effect.fn(
  "contentRelease.projectQuranReadingSourcesFor"
)(function* <
  const Locale extends AppLocaleCode,
  const TranslationId extends QuranEmbeddedSourceId,
>(
  attribution: QuranAttribution,
  appLocale: Locale,
  translationSourceId: TranslationId
) {
  const [arabic, translation] = yield* Effect.all(
    [
      projectEmbeddedQuranSource(attribution, appLocale, ARABIC_SOURCE_ID),
      projectEmbeddedQuranSource(attribution, appLocale, translationSourceId),
    ],
    { concurrency: "unbounded" }
  );
  return { arabic, translation };
});

/** Preserves the exact locale and translation-source union in the return type. */
const projectQuranReadingSources = Effect.fn(
  "contentRelease.projectQuranReadingSources"
)(function* (attribution: QuranAttribution, appLocale: AppLocaleCode) {
  if (appLocale === ENGLISH_APP_LOCALE_CODE) {
    return yield* projectQuranReadingSourcesFor(
      attribution,
      appLocale,
      quranTranslationSourceId(ENGLISH_APP_LOCALE_CODE)
    );
  }
  if (appLocale === INDONESIAN_APP_LOCALE_CODE) {
    return yield* projectQuranReadingSourcesFor(
      attribution,
      appLocale,
      quranTranslationSourceId(INDONESIAN_APP_LOCALE_CODE)
    );
  }
  return yield* projectQuranReadingSourcesFor(
    attribution,
    appLocale,
    quranTranslationSourceId(GERMAN_APP_LOCALE_CODE)
  );
});

/** Reads complete signed reading sources and locale-specific Tafsir access. */
export const readQuranLocaleSources = Effect.fn(
  "contentRelease.readQuranLocaleSources"
)(function* (snapshotId: string, appLocale: AppLocaleCode) {
  const attribution = yield* readQuranAttributionRow(snapshotId);
  if (
    !attribution.payload.activeAppLocales.includes(
      AppLocaleSchema.make(appLocale)
    )
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Active Quran snapshot ${snapshotId} excludes locale ${appLocale}.`
    );
  }
  // The decoded attribution contract guarantees source kinds, identities,
  // complete localized copy, and exact Tafsir access for every active locale.
  const sources = yield* projectQuranReadingSources(attribution, appLocale);
  const access = yield* Effect.fromNullishOr(
    attribution.payload.tafsirAccess.find(
      (candidate) => candidate.appLocale === appLocale
    )
  ).pipe(Effect.orDie);
  if (access.kind === "embedded") {
    const sourceId = quranTafsirSourceId(INDONESIAN_APP_LOCALE_CODE);
    const source = yield* projectEmbeddedQuranSource(
      attribution,
      INDONESIAN_APP_LOCALE_CODE,
      sourceId
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
      attribution,
      ENGLISH_APP_LOCALE_CODE,
      sourceId
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
    attribution,
    GERMAN_APP_LOCALE_CODE,
    sourceId
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
