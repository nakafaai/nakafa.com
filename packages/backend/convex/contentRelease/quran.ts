import { query } from "@repo/backend/convex/_generated/server";
import { readQuranAttribution } from "@repo/backend/convex/contentRelease/quran/attribution";
import { readQuranSurahs } from "@repo/backend/convex/contentRelease/quran/catalog";
import {
  quranDocumentValidator,
  quranSurahValidator,
  readQuranDocument,
  readQuranSurah,
} from "@repo/backend/convex/contentRelease/quran/document";
import {
  quranInterpretationValidator,
  readQuranInterpretation,
} from "@repo/backend/convex/contentRelease/quran/interpretation";
import {
  quranMarkdownValidator,
  quranProseValidator,
  readQuranMarkdown,
  readQuranProse,
} from "@repo/backend/convex/contentRelease/quran/markdown";
import {
  quranPassageValidator,
  quranReferenceValidator,
  readQuranPassage,
  readQuranReference,
} from "@repo/backend/convex/contentRelease/quran/reference";
import {
  quranAppLocaleValidator,
  quranReferenceArgsValidator,
  quranSourceFields,
  quranTafsirAppLocaleValidator,
} from "@repo/backend/convex/contentRelease/quran/spec";
import {
  quranDocumentV1Validator,
  quranInterpretationV1Validator,
  quranMarkdownV1Validator,
  quranReferenceV1Validator,
  quranViewV1Validator,
  readQuranDocumentV1,
  readQuranInterpretationV1,
  readQuranMarkdownV1,
  readQuranReferenceV1,
  readQuranViewV1,
} from "@repo/backend/convex/contentRelease/quran/v1";
import {
  quranPageValidator,
  quranViewValidator,
  readQuranPage,
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

/** Returns the narrow locale-specific Quran document used by the public API. */
export const document = query({
  args: { appLocale: quranAppLocaleValidator, surahNumber: v.number() },
  returns: quranDocumentV1Validator,
  handler: (ctx, { appLocale, surahNumber }) =>
    runConvexProgram(readQuranDocumentV1(ctx, appLocale, surahNumber)),
});

/** Returns the canonical V2 Quran document with semantic provenance. */
export const documentV2 = query({
  args: { appLocale: quranAppLocaleValidator, surahNumber: v.number() },
  returns: quranDocumentValidator,
  handler: (ctx, { appLocale, surahNumber }) =>
    runConvexProgram(readQuranDocument(ctx, appLocale, surahNumber)),
});

/** Returns one complete signed Quran surah for product and public readers. */
export const surah = query({
  args: { appLocale: quranAppLocaleValidator, surahNumber: v.number() },
  returns: quranSurahValidator,
  handler: (ctx, { appLocale, surahNumber }) =>
    runConvexProgram(readQuranSurah(ctx, appLocale, surahNumber)),
});

/** Returns the exact signed fields rendered by Quran markdown consumers. */
export const markdown = query({
  args: {
    appLocale: quranAppLocaleValidator,
    surahNumber: v.number(),
    verseLimit: v.optional(v.number()),
  },
  returns: quranMarkdownV1Validator,
  handler: (ctx, { appLocale, surahNumber, verseLimit }) =>
    runConvexProgram(
      readQuranMarkdownV1(ctx, appLocale, surahNumber, verseLimit)
    ),
});

/** Returns canonical V2 Quran markdown fields with semantic provenance. */
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

/** Returns one signed Quran surah as semantic Markdown source fields. */
export const prose = query({
  args: {
    appLocale: quranAppLocaleValidator,
    surahNumber: v.number(),
    verseLimit: v.optional(v.number()),
  },
  returns: quranProseValidator,
  handler: (ctx, { appLocale, surahNumber, verseLimit }) =>
    runConvexProgram(readQuranProse(ctx, appLocale, surahNumber, verseLimit)),
});

/** Returns the narrow locale-specific Quran projection used by the web UI. */
export const view = query({
  args: { appLocale: quranAppLocaleValidator, surahNumber: v.number() },
  returns: quranViewV1Validator,
  handler: (ctx, { appLocale, surahNumber }) =>
    runConvexProgram(readQuranViewV1(ctx, appLocale, surahNumber)),
});

/** Returns the canonical V2 Quran projection used by the web UI. */
export const viewV2 = query({
  args: { appLocale: quranAppLocaleValidator, surahNumber: v.number() },
  returns: quranViewValidator,
  handler: (ctx, { appLocale, surahNumber }) =>
    runConvexProgram(readQuranView(ctx, appLocale, surahNumber)),
});

/** Returns the signed Quran page projection used by the web product. */
export const page = query({
  args: { appLocale: quranAppLocaleValidator, surahNumber: v.number() },
  returns: quranPageValidator,
  handler: (ctx, { appLocale, surahNumber }) =>
    runConvexProgram(readQuranPage(ctx, appLocale, surahNumber)),
});

/** Returns one exact signed tafsir only after the verse is requested. */
export const interpretation = query({
  args: {
    expectedSnapshotId: v.string(),
    appLocale: quranTafsirAppLocaleValidator,
    surahNumber: v.number(),
    verseNumber: v.number(),
  },
  returns: quranInterpretationV1Validator,
  handler: (ctx, { appLocale, expectedSnapshotId, surahNumber, verseNumber }) =>
    runConvexProgram(
      readQuranInterpretationV1(
        ctx,
        appLocale,
        expectedSnapshotId,
        surahNumber,
        verseNumber
      )
    ),
});

/** Returns canonical V2 on-demand Tafsir with signed access metadata. */
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

/** Returns one bounded localized Quran verse reference. */
export const reference = query({
  args: quranReferenceArgsValidator.fields,
  returns: quranReferenceV1Validator,
  handler: (ctx, args) => runConvexProgram(readQuranReferenceV1(ctx, args)),
});

/** Returns one canonical V2 localized Quran verse reference. */
export const referenceV2 = query({
  args: quranReferenceArgsValidator.fields,
  returns: quranReferenceValidator,
  handler: (ctx, args) => runConvexProgram(readQuranReference(ctx, args)),
});

/** Returns one bounded signed Quran passage with semantic provenance. */
export const passage = query({
  args: quranReferenceArgsValidator.fields,
  returns: quranPassageValidator,
  handler: (ctx, args) => runConvexProgram(readQuranPassage(ctx, args)),
});
