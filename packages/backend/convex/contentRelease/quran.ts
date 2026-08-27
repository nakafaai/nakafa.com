import { query } from "@repo/backend/convex/_generated/server";
import { readQuranAttribution } from "@repo/backend/convex/contentRelease/quran/attribution";
import { quranBismillahValidator } from "@repo/backend/convex/contentRelease/quran/bismillah";
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
  quranPredecessorDocumentValidator,
  quranPredecessorInterpretationValidator,
  quranPredecessorMarkdownValidator,
  quranPredecessorReferenceValidator,
  quranPredecessorViewValidator,
  readQuranPredecessorDocument,
  readQuranPredecessorInterpretation,
  readQuranPredecessorMarkdown,
  readQuranPredecessorReference,
  readQuranPredecessorView,
} from "@repo/backend/convex/contentRelease/quran/predecessor";
import { readQuranReference } from "@repo/backend/convex/contentRelease/quran/reference";
import {
  quranAppLocaleValidator,
  quranReadingSourcesValidator,
  quranReferenceArgsValidator,
  quranSourceFields,
  quranTafsirAccessValidator,
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

const referenceValidator = v.object({
  ...quranSourceFields,
  chunkJson: v.array(v.string()),
  fromVerse: v.number(),
  preBismillah: v.union(quranBismillahValidator, v.null()),
  searchJson: v.union(v.string(), v.null()),
  sources: v.union(quranReadingSourcesValidator, v.null()),
  surahJson: v.union(v.string(), v.null()),
  tafsirAccess: v.union(quranTafsirAccessValidator, v.null()),
  toVerse: v.number(),
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
  returns: quranPredecessorDocumentValidator,
  handler: (ctx, { appLocale, surahNumber }) =>
    runConvexProgram(readQuranPredecessorDocument(ctx, appLocale, surahNumber)),
});

/** Returns one complete signed Quran surah for product and public readers. */
export const surah = query({
  args: { appLocale: quranAppLocaleValidator, surahNumber: v.number() },
  returns: quranDocumentValidator,
  handler: (ctx, { appLocale, surahNumber }) =>
    runConvexProgram(readQuranDocument(ctx, appLocale, surahNumber)),
});

/** Deprecated rollout alias for clients switching to `surah`. */
export const documentV2 = query({
  args: { appLocale: quranAppLocaleValidator, surahNumber: v.number() },
  returns: quranDocumentValidator,
  handler: (ctx, { appLocale, surahNumber }) =>
    runConvexProgram(readQuranDocument(ctx, appLocale, surahNumber)),
});

/** Returns the exact signed fields rendered by Quran markdown consumers. */
export const markdown = query({
  args: {
    appLocale: quranAppLocaleValidator,
    surahNumber: v.number(),
    verseLimit: v.optional(v.number()),
  },
  returns: quranPredecessorMarkdownValidator,
  handler: (ctx, { appLocale, surahNumber, verseLimit }) =>
    runConvexProgram(
      readQuranPredecessorMarkdown(ctx, appLocale, surahNumber, verseLimit)
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
      readQuranMarkdown(ctx, appLocale, surahNumber, verseLimit)
    ),
});

/** Deprecated rollout alias for clients switching to `prose`. */
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

/** Returns the narrow locale-specific Quran projection used by the web UI. */
export const view = query({
  args: { appLocale: quranAppLocaleValidator, surahNumber: v.number() },
  returns: quranPredecessorViewValidator,
  handler: (ctx, { appLocale, surahNumber }) =>
    runConvexProgram(readQuranPredecessorView(ctx, appLocale, surahNumber)),
});

/** Returns the signed Quran page projection used by the web product. */
export const page = query({
  args: { appLocale: quranAppLocaleValidator, surahNumber: v.number() },
  returns: quranViewValidator,
  handler: (ctx, { appLocale, surahNumber }) =>
    runConvexProgram(readQuranView(ctx, appLocale, surahNumber)),
});

/** Deprecated rollout alias for clients switching to `page`. */
export const viewV2 = query({
  args: { appLocale: quranAppLocaleValidator, surahNumber: v.number() },
  returns: quranViewValidator,
  handler: (ctx, { appLocale, surahNumber }) =>
    runConvexProgram(readQuranView(ctx, appLocale, surahNumber)),
});

/** Returns one exact signed tafsir only after the verse is requested. */
export const interpretation = query({
  args: {
    expectedSnapshotId: v.string(),
    appLocale: quranTafsirAppLocaleValidator,
    surahNumber: v.number(),
    verseNumber: v.number(),
  },
  returns: quranPredecessorInterpretationValidator,
  handler: (ctx, { appLocale, expectedSnapshotId, surahNumber, verseNumber }) =>
    runConvexProgram(
      readQuranPredecessorInterpretation(
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

/** Deprecated rollout alias for clients switching to `tafsir`. */
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

/** Returns one bounded localized Quran verse reference. */
export const reference = query({
  args: quranReferenceArgsValidator.fields,
  returns: quranPredecessorReferenceValidator,
  handler: (ctx, args) =>
    runConvexProgram(readQuranPredecessorReference(ctx, args)),
});

/** Returns one bounded signed Quran passage with semantic provenance. */
export const passage = query({
  args: quranReferenceArgsValidator.fields,
  returns: referenceValidator,
  handler: (ctx, args) => runConvexProgram(readQuranReference(ctx, args)),
});

/** Deprecated rollout alias for clients switching to `passage`. */
export const referenceV2 = query({
  args: quranReferenceArgsValidator.fields,
  returns: referenceValidator,
  handler: (ctx, args) => runConvexProgram(readQuranReference(ctx, args)),
});
