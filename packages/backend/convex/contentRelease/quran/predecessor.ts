import type {
  AppLocaleCode,
  INDONESIAN_APP_LOCALE_CODE,
} from "@nakafa/aksara-contracts/locale";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { loadQuranDocument } from "@repo/backend/convex/contentRelease/quran/document";
import { readQuranInterpretation } from "@repo/backend/convex/contentRelease/quran/interpretation";
import { loadQuranMarkdown } from "@repo/backend/convex/contentRelease/quran/markdown";
import { readQuranReference } from "@repo/backend/convex/contentRelease/quran/reference";
import {
  type QuranSourceEnvelope,
  quranAppLocaleValidator,
  quranRevelationPlaceValidator,
  quranSourceFields,
  quranTafsirAppLocaleValidator,
} from "@repo/backend/convex/contentRelease/quran/spec";
import { loadQuranView } from "@repo/backend/convex/contentRelease/quran/view";
import { v } from "convex/values";
import { Effect } from "effect";

const quranPredecessorTafsirAccessValidator = v.object({
  appLocale: quranAppLocaleValidator,
  kind: v.union(v.literal("embedded"), v.literal("external")),
  notice: v.string(),
  source: v.object({ label: v.string(), url: v.string() }),
});

const quranPredecessorSurahValidator = v.object({
  name: v.object({ translation: v.string(), transliteration: v.string() }),
  number: v.number(),
  numberOfVerses: v.number(),
});

/** Immutable predecessor Quran document response. */
export const quranPredecessorDocumentValidator = v.object({
  ...quranSourceFields,
  appLocale: quranAppLocaleValidator,
  surah: v.union(
    v.object({
      kind: v.literal("quran-surah"),
      name: v.object({
        arabic: v.string(),
        translation: v.string(),
        transliteration: v.string(),
      }),
      number: v.number(),
      numberOfVerses: v.number(),
      revelation: v.object({
        order: v.number(),
        place: quranRevelationPlaceValidator,
      }),
    }),
    v.null()
  ),
  verses: v.array(
    v.object({
      arabic: v.string(),
      number: v.object({ inQuran: v.number(), inSurah: v.number() }),
      translation: v.object({ footnotes: v.string(), text: v.string() }),
    })
  ),
});

/** Immutable predecessor Quran markdown response. */
export const quranPredecessorMarkdownValidator = v.object({
  ...quranSourceFields,
  appLocale: quranAppLocaleValidator,
  surah: v.union(
    v.object({
      ...quranPredecessorSurahValidator.fields,
      revelation: v.object({ place: quranRevelationPlaceValidator }),
    }),
    v.null()
  ),
  tafsirAccess: v.union(quranPredecessorTafsirAccessValidator, v.null()),
  toVerse: v.number(),
  verses: v.array(
    v.object({
      arabic: v.string(),
      number: v.object({ inSurah: v.number() }),
      translation: v.object({ footnotes: v.string(), text: v.string() }),
    })
  ),
});

/** Immutable predecessor Quran view response. */
export const quranPredecessorViewValidator = v.object({
  ...quranSourceFields,
  appLocale: quranAppLocaleValidator,
  nextSurah: v.union(quranPredecessorSurahValidator, v.null()),
  previousSurah: v.union(quranPredecessorSurahValidator, v.null()),
  surah: v.union(quranPredecessorSurahValidator, v.null()),
  tafsirAccess: v.union(quranPredecessorTafsirAccessValidator, v.null()),
  verses: v.array(
    v.object({
      arabic: v.string(),
      number: v.object({ inQuran: v.number(), inSurah: v.number() }),
      translation: v.string(),
      translationFootnotes: v.string(),
    })
  ),
});

/** Immutable predecessor on-demand Tafsir response. */
export const quranPredecessorInterpretationValidator = v.object({
  ...quranSourceFields,
  appLocale: quranTafsirAppLocaleValidator,
  interpretation: v.union(v.string(), v.null()),
  surahNumber: v.number(),
  verseNumber: v.number(),
});

/** Immutable predecessor bounded-reference response. */
export const quranPredecessorReferenceValidator = v.object({
  ...quranSourceFields,
  chunkJson: v.array(v.string()),
  fromVerse: v.number(),
  searchJson: v.union(v.string(), v.null()),
  surahJson: v.union(v.string(), v.null()),
  toVerse: v.number(),
});

function sourceFields(source: QuranSourceEnvelope) {
  return {
    activeManifestHash: source.activeManifestHash,
    activeReleaseId: source.activeReleaseId,
    managed: source.managed,
    snapshotId: source.snapshotId,
    sourceOrigin: source.sourceOrigin,
    sourceRevision: source.sourceRevision,
  };
}

function tafsirAccess(
  access: Effect.Success<ReturnType<typeof loadQuranView>>["tafsirAccess"]
) {
  if (access === null) {
    return null;
  }
  return {
    appLocale: access.appLocale,
    kind: access.kind,
    notice: access.notice,
    source: { label: access.source.label, url: access.source.updateUrl },
  };
}

function surah(
  value: Effect.Success<ReturnType<typeof loadQuranView>>["surah"]
) {
  if (value === null) {
    return null;
  }
  return {
    name: {
      translation: value.name.meaning.text,
      transliteration: value.name.transliteration,
    },
    number: value.number,
    numberOfVerses: value.numberOfVerses,
  };
}

/** Adapts the canonical document into its exact predecessor contract. */
export const readQuranPredecessorDocument = Effect.fn(
  "contentRelease.readQuranPredecessorDocument"
)(function* (ctx: QueryCtx, appLocale: AppLocaleCode, surahNumber: number) {
  const result = yield* loadQuranDocument(ctx, appLocale, surahNumber);
  return {
    ...sourceFields(result),
    appLocale: result.appLocale,
    surah:
      result.surah === null
        ? null
        : {
            ...result.surah,
            name: {
              arabic: result.surah.name.arabic,
              translation: result.surah.name.meaning.text,
              transliteration: result.surah.name.transliteration,
            },
          },
    verses: result.verses.map(({ arabic, number, translation }) => ({
      arabic,
      number,
      translation,
    })),
  };
});

/** Adapts canonical markdown into its exact predecessor contract. */
export const readQuranPredecessorMarkdown = Effect.fn(
  "contentRelease.readQuranPredecessorMarkdown"
)(function* (
  ctx: QueryCtx,
  appLocale: AppLocaleCode,
  surahNumber: number,
  verseLimit?: number
) {
  const result = yield* loadQuranMarkdown(
    ctx,
    appLocale,
    surahNumber,
    verseLimit
  );
  const projectedSurah = surah(result.surah);
  return {
    ...sourceFields(result),
    appLocale: result.appLocale,
    surah:
      projectedSurah === null || result.surah === null
        ? null
        : {
            ...projectedSurah,
            revelation: { place: result.surah.revelation.place },
          },
    tafsirAccess: tafsirAccess(result.tafsirAccess),
    toVerse: result.toVerse,
    verses: result.verses.map(({ arabic, number, translation }) => ({
      arabic,
      number,
      translation,
    })),
  };
});

/** Adapts the canonical view into its exact predecessor contract. */
export const readQuranPredecessorView = Effect.fn(
  "contentRelease.readQuranPredecessorView"
)(function* (ctx: QueryCtx, appLocale: AppLocaleCode, surahNumber: number) {
  const result = yield* loadQuranView(ctx, appLocale, surahNumber);
  return {
    ...sourceFields(result),
    appLocale: result.appLocale,
    nextSurah: surah(result.nextSurah),
    previousSurah: surah(result.previousSurah),
    surah: surah(result.surah),
    tafsirAccess: tafsirAccess(result.tafsirAccess),
    verses: result.verses.map(({ arabic, number, translation }) => ({
      arabic,
      number,
      translation: translation.text,
      translationFootnotes: translation.footnotes,
    })),
  };
});

/** Adapts on-demand Tafsir into its exact predecessor contract. */
export const readQuranPredecessorInterpretation = Effect.fn(
  "contentRelease.readQuranPredecessorInterpretation"
)(function* (
  ctx: QueryCtx,
  appLocale: typeof INDONESIAN_APP_LOCALE_CODE,
  expectedSnapshotId: string,
  surahNumber: number,
  verseNumber: number
) {
  const result = yield* readQuranInterpretation(
    ctx,
    appLocale,
    expectedSnapshotId,
    surahNumber,
    verseNumber
  );
  return {
    ...sourceFields(result),
    appLocale: result.appLocale,
    interpretation: result.interpretation,
    surahNumber: result.surahNumber,
    verseNumber: result.verseNumber,
  };
});

/** Adapts one bounded reference into its exact predecessor contract. */
export const readQuranPredecessorReference = Effect.fn(
  "contentRelease.readQuranPredecessorReference"
)(function* (
  ctx: QueryCtx,
  request: {
    readonly appLocale: AppLocaleCode;
    readonly fromVerse: number;
    readonly surahNumber: number;
    readonly toVerse?: number;
  }
) {
  const result = yield* readQuranReference(ctx, request);
  return {
    ...sourceFields(result),
    chunkJson: result.chunkJson,
    fromVerse: result.fromVerse,
    searchJson: result.searchJson,
    surahJson: result.surahJson,
    toVerse: result.toVerse,
  };
});
