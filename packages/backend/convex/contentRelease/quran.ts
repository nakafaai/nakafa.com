import { readQuranAttribution } from "@repo/backend/content/quran/attribution";
import { readQuranSurahs } from "@repo/backend/content/quran/catalog";
import { convexQuranLayer } from "@repo/backend/content/quran/convex";
import {
  quranDocumentValidator,
  readQuranDocument,
} from "@repo/backend/content/quran/document";
import {
  quranInterpretationValidator,
  readQuranInterpretation,
} from "@repo/backend/content/quran/interpretation";
import {
  quranMarkdownValidator,
  readQuranMarkdown,
} from "@repo/backend/content/quran/markdown";
import {
  quranPassageValidator,
  readQuranPassage,
} from "@repo/backend/content/quran/reference";
import {
  quranViewValidator,
  readQuranView,
} from "@repo/backend/content/quran/view";
import { query } from "@repo/backend/convex/_generated/server";
import {
  quranAppLocaleValidator,
  quranReferenceArgsValidator,
  quranSourceFields,
  quranTafsirAppLocaleValidator,
} from "@repo/backend/convex/contentRelease/quran/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";
import { Effect } from "effect";

const attributionValidator = v.object({
  ...quranSourceFields,
  rowJson: v.union(v.string(), v.null()),
});

const surahCatalogValidator = v.object({
  ...quranSourceFields,
  rowJson: v.array(v.string()),
});

/** Returns the visible signed source attribution for active Quran content. */
export const attribution = query({
  args: {},
  returns: attributionValidator,
  handler: (ctx) =>
    runConvexProgram(
      readQuranAttribution().pipe(Effect.provide(convexQuranLayer(ctx)))
    ),
});

/** Returns every verified Quran surah metadata row without verse bodies. */
export const surahs = query({
  args: {},
  returns: surahCatalogValidator,
  handler: (ctx) =>
    runConvexProgram(
      readQuranSurahs().pipe(Effect.provide(convexQuranLayer(ctx)))
    ),
});

/** Returns one complete signed Quran surah for product and public readers. */
export const surah = query({
  args: { appLocale: quranAppLocaleValidator, surahNumber: v.number() },
  returns: quranDocumentValidator,
  handler: (ctx, { appLocale, surahNumber }) =>
    runConvexProgram(
      readQuranDocument(appLocale, surahNumber).pipe(
        Effect.provide(convexQuranLayer(ctx))
      )
    ),
});

/** Returns one signed Quran surah as semantic Markdown source fields. */
export const prose = query({
  args: {
    appLocale: quranAppLocaleValidator,
    surahNumber: v.number(),
    verseLimit: v.optional(v.number()),
  },
  returns: quranMarkdownValidator,
  handler: (ctx, { appLocale, surahNumber, verseLimit }) =>
    runConvexProgram(
      readQuranMarkdown(appLocale, surahNumber, verseLimit).pipe(
        Effect.provide(convexQuranLayer(ctx))
      )
    ),
});

/** Returns the signed Quran page projection used by the web product. */
export const page = query({
  args: { appLocale: quranAppLocaleValidator, surahNumber: v.number() },
  returns: quranViewValidator,
  handler: (ctx, { appLocale, surahNumber }) =>
    runConvexProgram(
      readQuranView(appLocale, surahNumber).pipe(
        Effect.provide(convexQuranLayer(ctx))
      )
    ),
});

/** Returns one exact signed Tafsir entry after the verse is requested. */
export const tafsir = query({
  args: {
    expectedSnapshotId: v.string(),
    appLocale: quranTafsirAppLocaleValidator,
    surahNumber: v.number(),
    verseNumber: v.number(),
  },
  returns: quranInterpretationValidator,
  handler: (ctx, { appLocale, expectedSnapshotId, surahNumber, verseNumber }) =>
    runConvexProgram(
      readQuranInterpretation(
        appLocale,
        expectedSnapshotId,
        surahNumber,
        verseNumber
      ).pipe(Effect.provide(convexQuranLayer(ctx)))
    ),
});

/** Returns one bounded signed Quran passage with semantic provenance. */
export const passage = query({
  args: quranReferenceArgsValidator.fields,
  returns: quranPassageValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      readQuranPassage(args).pipe(Effect.provide(convexQuranLayer(ctx)))
    ),
});
