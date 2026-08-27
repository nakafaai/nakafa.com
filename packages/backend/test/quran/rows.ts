import {
  PublicPathSchema,
  type Sha256Hash,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  ACTIVE_APP_LOCALES,
  type ActiveAppLocaleList,
  type AppLocaleCode,
  ENGLISH_APP_LOCALE_CODE,
  GERMAN_APP_LOCALE_CODE,
  INDONESIAN_APP_LOCALE_CODE,
  makeAppLocale,
} from "@nakafa/aksara-contracts/locale";
import {
  type QuranEmbeddedSourceId,
  QuranEmbeddedSourceIdSchema,
  type QuranExternalSourceId,
  quranReadingSourceIds,
  quranTafsirSourceId,
  quranTranslationSourceId,
} from "@nakafa/aksara-contracts/quran/identity";
import {
  QuranChunkRowSchema,
  type QuranRowPayload,
  type QuranRuntimeVerse,
  QuranRuntimeVerseSchema,
  QuranSearchRowSchema,
} from "@nakafa/aksara-contracts/quran/snapshot/row";
import { bindQuranRow } from "@nakafa/aksara-contracts/quran/snapshot/row/hash";
import {
  QuranAttributionRowSchema,
  type QuranTafsirAccess,
  quranSourceIds,
} from "@nakafa/aksara-contracts/quran/source";
import {
  type QuranSurahRow,
  QuranSurahRowSchema,
} from "@nakafa/aksara-contracts/quran/spec";
import { canonicalizeContentSnapshotRow } from "@nakafa/aksara-contracts/release/snapshot/data";
import { Effect, Schema } from "effect";

const testDigest = Sha256HashSchema.make(`sha256:${"1".repeat(64)}`);
type QuranChunkRow = typeof QuranChunkRowSchema.Type;
type QuranSearchRow = typeof QuranSearchRowSchema.Type;

/** Builds one complete embedded source projection for transport tests. */
function makeEmbeddedSource<
  const SourceId extends QuranEmbeddedSourceId,
  const Locale extends AppLocaleCode,
>(id: SourceId, appLocale: Locale) {
  const artifact = { byteCount: 1, digest: testDigest, fileCount: 1 };
  return {
    artifact,
    id,
    kind: "embedded" as const,
    label: `Technical source ${id} ${appLocale}`,
    notice: `Technical attribution notice ${appLocale}`,
    publisher: "Nakafa protocol tests",
    retrievedAt: "2026-07-31T00:00:00Z",
    sourceUrl: `https://example.test/${id}`,
    terms: { artifact, url: `https://example.test/${id}/terms` },
    updateUrl: `https://example.test/${id}/updates`,
    version: "technical-version",
  };
}

/** Builds one complete external source projection for transport tests. */
function makeExternalSource<
  const SourceId extends QuranExternalSourceId,
  const Locale extends AppLocaleCode,
>(id: SourceId, appLocale: Locale) {
  return {
    id,
    kind: "external" as const,
    label: `Technical source ${id} ${appLocale}`,
    notice: `Technical attribution notice ${appLocale}`,
    publisher: "Nakafa protocol tests",
    retrievedAt: "2026-07-31T00:00:00Z",
    sourceUrl: `https://example.test/${id}`,
    terms: {
      access: "link-only" as const,
      url: `https://example.test/${id}/terms`,
    },
    updateUrl: `https://example.test/${id}/updates`,
    version: "technical-version",
  };
}

/** Builds an exact locale and translation-source relationship. */
function projectQuranLocaleSources<
  const Locale extends AppLocaleCode,
  const TranslationId extends QuranEmbeddedSourceId,
>(appLocale: Locale, translationSourceId: TranslationId) {
  const arabicSourceId = quranReadingSourceIds(appLocale)[0];
  return {
    arabic: makeEmbeddedSource(arabicSourceId, appLocale),
    translation: makeEmbeddedSource(translationSourceId, appLocale),
  };
}

type QuranLocaleSources = ReturnType<typeof readTechnicalQuranLocaleSources>;

/** Preserves the exact locale relationship in technical source fixtures. */
function readTechnicalQuranLocaleSources(appLocale: AppLocaleCode) {
  if (appLocale === ENGLISH_APP_LOCALE_CODE) {
    return projectQuranLocaleSources(
      appLocale,
      quranTranslationSourceId(ENGLISH_APP_LOCALE_CODE)
    );
  }
  if (appLocale === INDONESIAN_APP_LOCALE_CODE) {
    return projectQuranLocaleSources(
      appLocale,
      quranTranslationSourceId(INDONESIAN_APP_LOCALE_CODE)
    );
  }
  return projectQuranLocaleSources(
    appLocale,
    quranTranslationSourceId(GERMAN_APP_LOCALE_CODE)
  );
}

/** Builds exact Arabic and locale translation source projections. */
export function makeQuranLocaleSources(
  appLocale: "en"
): Extract<QuranLocaleSources, { translation: { id: "quranenc-english" } }>;
export function makeQuranLocaleSources(
  appLocale: "id"
): Extract<QuranLocaleSources, { translation: { id: "quranenc-indonesian" } }>;
export function makeQuranLocaleSources(
  appLocale: "de"
): Extract<QuranLocaleSources, { translation: { id: "quranenc-german" } }>;
export function makeQuranLocaleSources(
  appLocale: AppLocaleCode
): QuranLocaleSources;
export function makeQuranLocaleSources(appLocale: AppLocaleCode) {
  return readTechnicalQuranLocaleSources(appLocale);
}

/** Builds the exact locale Tafsir access projection. */
function projectQuranTafsir(appLocale: AppLocaleCode) {
  if (appLocale === INDONESIAN_APP_LOCALE_CODE) {
    const access = quranTafsirAccessByLocale[INDONESIAN_APP_LOCALE_CODE];
    return {
      appLocale: access.appLocale,
      kind: access.kind,
      notice: access.notice,
      source: makeEmbeddedSource(access.sourceId, access.appLocale),
    };
  }
  if (appLocale === ENGLISH_APP_LOCALE_CODE) {
    const access = quranTafsirAccessByLocale[ENGLISH_APP_LOCALE_CODE];
    return {
      appLocale: access.appLocale,
      kind: access.kind,
      notice: access.notice,
      source: makeExternalSource(access.sourceId, access.appLocale),
    };
  }
  const access = quranTafsirAccessByLocale[GERMAN_APP_LOCALE_CODE];
  return {
    appLocale: access.appLocale,
    kind: access.kind,
    notice: access.notice,
    source: makeExternalSource(access.sourceId, access.appLocale),
  };
}

type QuranTafsirProjection = ReturnType<typeof projectQuranTafsir>;

/** Builds the exact embedded Indonesian Tafsir access projection. */
export function makeQuranTafsirProjection(
  appLocale: "id"
): Extract<QuranTafsirProjection, { readonly kind: "embedded" }>;
/** Builds one exact link-only English or German Tafsir access projection. */
export function makeQuranTafsirProjection(
  appLocale: "de" | "en"
): Extract<QuranTafsirProjection, { readonly kind: "external" }>;
/** Builds one exact Tafsir access projection for a dynamic app locale. */
export function makeQuranTafsirProjection(
  appLocale: AppLocaleCode
): QuranTafsirProjection;
export function makeQuranTafsirProjection(appLocale: AppLocaleCode) {
  return projectQuranTafsir(appLocale);
}

const quranTafsirAccessByLocale = {
  de: {
    appLocale: makeAppLocale("de"),
    kind: "external",
    notice: "Technischer deutscher Tafsirhinweis.",
    sourceId: quranTafsirSourceId("de"),
  },
  en: {
    appLocale: makeAppLocale("en"),
    kind: "external",
    notice: "Technical English Tafsir notice.",
    sourceId: quranTafsirSourceId("en"),
  },
  id: {
    appLocale: makeAppLocale("id"),
    kind: "embedded",
    notice: "Catatan teknis tafsir Indonesia.",
    sourceId: quranTafsirSourceId("id"),
  },
} satisfies Record<AppLocaleCode, QuranTafsirAccess>;

/** Returns one complete technical Tafsir access record for protocol tests. */
export function makeQuranTafsirAccess(appLocale: AppLocaleCode) {
  return quranTafsirAccessByLocale[appLocale];
}

/** Creates the complete technical attribution row required by runtime tests. */
export function makeQuranAttribution(
  activeAppLocales: ActiveAppLocaleList = ACTIVE_APP_LOCALES
) {
  return Schema.decodeUnknownSync(QuranAttributionRowSchema)({
    activeAppLocales,
    kind: "quran-attribution",
    sources: quranSourceIds(activeAppLocales).map((id) => {
      const source = {
        copy: activeAppLocales.map((appLocale) => ({
          appLocale,
          notice: `Technical attribution notice ${appLocale}`,
          title: `Technical source ${id} ${appLocale}`,
        })),
        id,
        publisher: "Nakafa protocol tests",
        retrievedAt: "2026-07-31T00:00:00Z",
        sourceUrl: `https://example.test/${id}`,
        updateUrl: `https://example.test/${id}/updates`,
        version: "technical-version",
      };
      if (Schema.is(QuranEmbeddedSourceIdSchema)(id)) {
        return {
          ...source,
          artifact: { byteCount: 1, digest: testDigest, fileCount: 1 },
          kind: "embedded",
          terms: {
            artifact: { byteCount: 1, digest: testDigest, fileCount: 1 },
            url: `https://example.test/${id}/terms`,
          },
        };
      }
      return {
        ...source,
        kind: "external",
        terms: {
          access: "link-only",
          url: `https://example.test/${id}/terms`,
        },
      };
    }),
    tafsirAccess: activeAppLocales.map((appLocale) =>
      makeQuranTafsirAccess(appLocale)
    ),
  });
}

/** Creates one signed-contract surah metadata row for protocol tests. */
export function makeQuranSurah(
  surahNumber: number,
  numberOfVerses = 1
): QuranSurahRow {
  return QuranSurahRowSchema.make({
    kind: "quran-surah",
    name: {
      arabic: `سورة ${surahNumber}`,
      meaning: {
        appLocale: makeAppLocale("en"),
        text: `Technical meaning ${surahNumber}`,
      },
      transliteration: `Technical Surah ${surahNumber}`,
    },
    number: surahNumber,
    numberOfVerses,
    revelation: { order: surahNumber, place: "Meccan" },
  });
}

/** Creates one exact technical verse inside a bounded runtime chunk. */
function makeQuranVerse(
  inQuran: number,
  inSurah: number,
  translationFootnotes: Readonly<Partial<Record<AppLocaleCode, string>>>,
  translationText: Readonly<Partial<Record<AppLocaleCode, string>>>
): QuranRuntimeVerse {
  return Schema.decodeSync(QuranRuntimeVerseSchema)({
    meta: {
      hizbQuarter: 1,
      juz: 1,
      manzil: 1,
      page: 1,
      ruku: 1,
      sajda: null,
    },
    number: { inQuran, inSurah },
    tafsir: [
      {
        appLocale: "id",
        footnotes: null,
        text: `Tafsir teknis ${inSurah}`,
      },
    ],
    text: { arabic: `آية ${inSurah}` },
    translations: [
      {
        appLocale: "en",
        value: {
          footnotes: translationFootnotes.en ?? "",
          text: translationText.en ?? `Technical translation ${inSurah}`,
        },
      },
      {
        appLocale: "id",
        value: {
          footnotes: translationFootnotes.id ?? "",
          text: translationText.id ?? `Terjemahan teknis ${inSurah}`,
        },
      },
      {
        appLocale: "de",
        value: {
          footnotes: translationFootnotes.de ?? "",
          text: translationText.de ?? `Technische Übersetzung ${inSurah}`,
        },
      },
    ],
  });
}

/** Creates one coherent immutable Quran chunk for protocol tests. */
export function makeQuranChunk(input: {
  readonly arabicText?: string;
  readonly firstQuranNumber: number;
  readonly firstVerse: number;
  readonly surahNumber: number;
  readonly translationFootnotes?: Readonly<
    Partial<Record<AppLocaleCode, string>>
  >;
  readonly translationText?: Readonly<Partial<Record<AppLocaleCode, string>>>;
  readonly verseCount: number;
}): QuranChunkRow {
  const verses = Array.from({ length: input.verseCount }, (_, index) => {
    const verse = makeQuranVerse(
      input.firstQuranNumber + index,
      input.firstVerse + index,
      input.translationFootnotes ?? {},
      input.translationText ?? {}
    );
    return index === 0 && input.arabicText !== undefined
      ? { ...verse, text: { ...verse.text, arabic: input.arabicText } }
      : verse;
  });
  return Schema.decodeUnknownSync(QuranChunkRowSchema)({
    firstQuranNumber: input.firstQuranNumber,
    firstVerse: input.firstVerse,
    kind: "quran-chunk",
    lastVerse: input.firstVerse + input.verseCount - 1,
    surahNumber: input.surahNumber,
    verses,
  });
}

/** Creates one localized search row whose text is safe for test assertions. */
export function makeQuranSearch(
  appLocale: AppLocaleCode,
  surahNumber: number,
  text = `Technical search text ${surahNumber}`
): QuranSearchRow {
  return Schema.decodeSync(QuranSearchRowSchema)({
    appLocale,
    graph: {
      alignmentId: `alignment:quran:quran-surah:${surahNumber}`,
      assetId: `asset:${appLocale}:quran:quran-surah:${surahNumber}`,
      conceptId: `concept:quran:surah:${surahNumber}`,
      learningObjectId: `lo:quran-surah:${surahNumber}`,
      lensId: "lens:quran",
    },
    kind: "quran-search",
    route: PublicPathSchema.make(`quran/${surahNumber}`),
    surahNumber,
    text,
    title: `Technical Surah ${surahNumber}`,
  });
}

/** Encodes one authentic snapshot envelope for signed Quran consumer tests. */
export function encodeTestQuranRow(
  snapshotId: Sha256Hash,
  payload: QuranRowPayload
) {
  const record = Effect.runSync(bindQuranRow(snapshotId, payload));
  return canonicalizeContentSnapshotRow({ family: "quran", record });
}
