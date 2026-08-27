import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { loadQuranDocument } from "@repo/backend/convex/contentRelease/quran/document";
import { readQuranPassage } from "@repo/backend/convex/contentRelease/quran/reference";
import {
  type QuranReferenceArgs,
  type QuranSourceEnvelope,
  quranAppLocaleValidator,
  quranRevelationPlaceValidator,
  quranSourceFields,
} from "@repo/backend/convex/contentRelease/quran/spec";
import { v } from "convex/values";
import { Effect } from "effect";

/** Exact response consumed by the web release active before PR #390. */
export const quranDocumentBridgeValidator = v.object({
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

/** Exact bounded-reference response consumed before the PR #390 switch. */
export const quranReferenceBridgeValidator = v.object({
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

/** Adapts the canonical document for the already deployed API reader. */
export const readQuranDocumentBridge = Effect.fn(
  "contentRelease.readQuranDocumentBridge"
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

/** Adapts the canonical passage for the already deployed agent reader. */
export const readQuranReferenceBridge = Effect.fn(
  "contentRelease.readQuranReferenceBridge"
)(function* (ctx: QueryCtx, request: QuranReferenceArgs) {
  const result = yield* readQuranPassage(ctx, request);
  return {
    ...sourceFields(result),
    chunkJson: result.chunkJson,
    fromVerse: result.fromVerse,
    searchJson: result.searchJson,
    surahJson: result.surahJson,
    toVerse: result.toVerse,
  };
});
