import { query } from "@repo/backend/convex/_generated/server";
import { readQuranAttribution } from "@repo/backend/convex/contentRelease/quran/attribution";
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

/** Returns the signed Quran page projection used by the web product. */
export const page = query({
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

/** Returns one bounded signed Quran passage with semantic provenance. */
export const passage = query({
  args: quranReferenceArgsValidator.fields,
  returns: quranPassageValidator,
  handler: (ctx, args) => runConvexProgram(readQuranPassage(ctx, args)),
});
