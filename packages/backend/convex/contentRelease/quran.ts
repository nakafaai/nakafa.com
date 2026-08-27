import { query } from "@repo/backend/convex/_generated/server";
import { readQuranAttribution } from "@repo/backend/convex/contentRelease/quran/attribution";
import {
  quranDocumentBridgeValidator,
  quranReferenceBridgeValidator,
  readQuranDocumentBridge,
  readQuranReferenceBridge,
} from "@repo/backend/convex/contentRelease/quran/bridge";
import { readQuranSurahs } from "@repo/backend/convex/contentRelease/quran/catalog";
import {
  quranDocumentValidator,
  readQuranDocument,
} from "@repo/backend/convex/contentRelease/quran/document";
import {
  quranInterpretationValidator,
  readQuranInterpretation,
} from "@repo/backend/convex/contentRelease/quran/interpretation";
import {
  quranMarkdownValidator,
  readQuranMarkdown,
} from "@repo/backend/convex/contentRelease/quran/markdown";
import {
  quranPassageValidator,
  readQuranPassage,
} from "@repo/backend/convex/contentRelease/quran/reference";
import {
  quranAppLocaleValidator,
  quranReferenceArgsValidator,
  quranSourceFields,
  quranTafsirAppLocaleValidator,
} from "@repo/backend/convex/contentRelease/quran/spec";
import {
  quranViewValidator,
  readQuranView,
} from "@repo/backend/convex/contentRelease/quran/view";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";

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
  handler: (ctx) => runConvexProgram(readQuranAttribution(ctx)),
});

/** Returns every verified Quran surah metadata row without verse bodies. */
export const surahs = query({
  args: {},
  returns: surahCatalogValidator,
  handler: (ctx) => runConvexProgram(readQuranSurahs(ctx)),
});

/**
 * Temporary PR #390 bridge for the currently deployed private content reader.
 * Remove after the #390 API deployment serves the canonical surah query.
 */
export const document = query({
  args: { appLocale: quranAppLocaleValidator, surahNumber: v.number() },
  returns: quranDocumentBridgeValidator,
  handler: (ctx, { appLocale, surahNumber }) =>
    runConvexProgram(readQuranDocumentBridge(ctx, appLocale, surahNumber)),
});

/** Returns one complete signed Quran surah for product and public readers. */
export const surah = query({
  args: { appLocale: quranAppLocaleValidator, surahNumber: v.number() },
  returns: quranDocumentValidator,
  handler: (ctx, { appLocale, surahNumber }) =>
    runConvexProgram(readQuranDocument(ctx, appLocale, surahNumber)),
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
      readQuranMarkdown(ctx, appLocale, surahNumber, verseLimit)
    ),
});

/**
 * Temporary PR #390 bridge for the currently deployed WWW bundle.
 * Remove after the #390 WWW deployment serves the canonical prose reader.
 */
export const markdownV2 = query({
  args: {
    appLocale: quranAppLocaleValidator,
    surahNumber: v.number(),
    verseLimit: v.optional(v.number()),
  },
  returns: quranMarkdownValidator,
  handler: (ctx, { appLocale, surahNumber, verseLimit }) =>
    runConvexProgram(
      readQuranMarkdown(ctx, appLocale, surahNumber, verseLimit)
    ),
});

/** Returns the signed Quran page projection used by the web product. */
export const page = query({
  args: { appLocale: quranAppLocaleValidator, surahNumber: v.number() },
  returns: quranViewValidator,
  handler: (ctx, { appLocale, surahNumber }) =>
    runConvexProgram(readQuranView(ctx, appLocale, surahNumber)),
});

/**
 * Temporary PR #390 bridge for the currently deployed WWW bundle.
 * Remove after the #390 WWW deployment serves the canonical page reader.
 */
export const viewV2 = query({
  args: { appLocale: quranAppLocaleValidator, surahNumber: v.number() },
  returns: quranViewValidator,
  handler: (ctx, { appLocale, surahNumber }) =>
    runConvexProgram(readQuranView(ctx, appLocale, surahNumber)),
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
        ctx,
        appLocale,
        expectedSnapshotId,
        surahNumber,
        verseNumber
      )
    ),
});

/**
 * Temporary PR #390 bridge for already-open WWW Quran pages.
 * Remove after the #390 WWW deployment serves the canonical Tafsir reader.
 */
export const interpretationV2 = query({
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
        ctx,
        appLocale,
        expectedSnapshotId,
        surahNumber,
        verseNumber
      )
    ),
});

/**
 * Temporary PR #390 bridge for the currently deployed agent Quran tool.
 * Remove after the #390 MCP and API deployments serve the canonical passage.
 */
export const reference = query({
  args: quranReferenceArgsValidator.fields,
  returns: quranReferenceBridgeValidator,
  handler: (ctx, args) => runConvexProgram(readQuranReferenceBridge(ctx, args)),
});

/** Returns one bounded signed Quran passage with semantic provenance. */
export const passage = query({
  args: quranReferenceArgsValidator.fields,
  returns: quranPassageValidator,
  handler: (ctx, args) => runConvexProgram(readQuranPassage(ctx, args)),
});
